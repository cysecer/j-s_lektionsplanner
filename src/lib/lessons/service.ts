import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Viewer } from "@/lib/auth/session";
import { canCoach, coachedTeamIds } from "@/lib/auth/team-access";
import { requireClubAssets } from "@/lib/assets/service";
import { blockToFormValues } from "@/lib/blocks/form-values";
import { getBlock } from "@/lib/blocks/queries";
import {
  blockInputSchema,
  customValuesSchema,
  type BlockContent,
  type Responsible,
} from "@/lib/blocks/schema";
import { cleanupImages, createBlock, updateBlock } from "@/lib/blocks/service";
import { db } from "@/lib/db";
import type { RichText } from "@/lib/rich-text/schema";
import { isRichTextEmpty } from "@/lib/rich-text/utils";
import { ActionFailure, toFieldErrors } from "@/lib/server/result";
import type { LessonGeneralValues, LessonItemInput, LessonSaveInput } from "./schema";
import { formatClockTime, resolveLessonDefaults } from "./timing";
import { visibleBlocksWhere, visibleLessonsWhere } from "./visibility";

const teamForbidden = () => new ActionFailure("forbidden", "teamForbidden");

const richOrNull = (doc: RichText | null) => (doc && !isRichTextEmpty(doc) ? doc : null);
const json = (doc: RichText | null) => richOrNull(doc) ?? Prisma.DbNull;

/** Today's calendar date in Switzerland, as stored (UTC midnight). */
export function todayInZurich() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  return new Date(`${iso}T00:00:00Z`);
}

// ---------------------------------------------------------------------------
// Create, duplicate, delete
// ---------------------------------------------------------------------------

/**
 * Team of a new lesson: the one chosen in the header if the person coaches
 * it. Someone who coaches only some teams gets their first team rather
 * than no team, which everyone in the club could see.
 */
function defaultTeam(viewer: Viewer) {
  const select = { id: true, defaultStartTimeMinutes: true, defaultDurationMinutes: true };
  if (viewer.activeTeamId && canCoach(viewer.teams, viewer.activeTeamId)) {
    return db.team.findFirst({
      where: { id: viewer.activeTeamId, clubId: viewer.clubId, archivedAt: null },
      select,
    });
  }
  const coached = coachedTeamIds(viewer.teams);
  if (!coached) return null;
  return db.team.findFirst({
    where: { clubId: viewer.clubId, archivedAt: null, id: { in: coached } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select,
  });
}

/**
 * Values for a new, not yet stored lesson: today, the header team (or the
 * person's first team), its times, the person as author and present coach.
 */
export async function newLessonValues(viewer: Viewer): Promise<LessonGeneralValues> {
  const [club, team, coach, user] = await Promise.all([
    db.club.findUniqueOrThrow({
      where: { id: viewer.clubId },
      select: {
        defaultStartTimeMinutes: true,
        defaultDurationMinutes: true,
        defaultLayoutId: true,
      },
    }),
    defaultTeam(viewer),
    viewer.coachId
      ? db.coach.findUnique({ where: { id: viewer.coachId }, select: { id: true, name: true } })
      : null,
    db.user.findUniqueOrThrow({ where: { id: viewer.userId }, select: { name: true } }),
  ]);
  const defaults = resolveLessonDefaults(club, team);
  return {
    title: "",
    authorName: coach?.name ?? user.name,
    date: todayInZurich().toISOString().slice(0, 10),
    teamId: team?.id ?? null,
    layoutId: club.defaultLayoutId,
    startTime: defaults.startTimeMinutes === null ? "" : formatClockTime(defaults.startTimeMinutes),
    totalDurationMinutes: defaults.durationMinutes === null ? "" : String(defaults.durationMinutes),
    location: "",
    ageMin: "",
    ageMax: "",
    groupSize: "",
    difficulty: null,
    safety: null,
    goals: null,
    notes: null,
    presentCoachIds: coach ? [coach.id] : [],
    status: "DRAFT",
  };
}

/**
 * Stores a new lesson the first time ("Entwurf speichern"): the record is
 * created and the content saved in one go. If the content is refused, no
 * empty lesson is left behind.
 */
export async function createLessonFromDraft(
  viewer: Viewer,
  input: Pick<LessonSaveInput, "lesson" | "items">,
) {
  const created = await db.lesson.create({
    data: {
      clubId: viewer.clubId,
      title: input.lesson.title,
      authorName: input.lesson.authorName,
      date: new Date(`${input.lesson.date}T00:00:00Z`),
      status: "DRAFT",
      createdById: viewer.userId,
    },
    select: { id: true, updatedAt: true },
  });
  try {
    const saved = await saveLesson(viewer, {
      id: created.id,
      baseVersion: created.updatedAt.toISOString(),
      lesson: { ...input.lesson, status: "DRAFT" },
      items: input.items,
    });
    return { id: created.id, version: saved.version };
  } catch (error) {
    await db.lesson.delete({ where: { id: created.id } });
    throw error;
  }
}

/**
 * Reuse a past lesson as template: a new draft dated today with copied
 * items. The copy belongs to whoever made it.
 */
export async function duplicateLesson(viewer: Viewer, id: string) {
  const source = await db.lesson.findFirst({
    where: { AND: [visibleLessonsWhere(viewer), { id }] },
    include: { presentCoaches: true, items: { include: { sketches: true } } },
  });
  if (!source) throw new ActionFailure("notFound");
  if (!canCoach(viewer.teams, source.teamId)) throw teamForbidden();
  const { id: _id, createdAt: _c, updatedAt: _u, presentCoaches, items, ...scalars } = source;
  return db.lesson.create({
    data: {
      ...scalars,
      safety: source.safety ?? Prisma.DbNull,
      goals: source.goals ?? Prisma.DbNull,
      notes: source.notes ?? Prisma.DbNull,
      date: todayInZurich(),
      status: "DRAFT",
      createdById: viewer.userId,
      presentCoaches: { create: presentCoaches.map((c) => ({ coachId: c.coachId })) },
      items: {
        create: items.map(
          ({ id: _i, lessonId: _l, createdAt: _ic, updatedAt: _iu, sketches, ...item }) => ({
            ...item,
            description: item.description ?? Prisma.DbNull,
            rules: item.rules ?? Prisma.DbNull,
            organization: item.organization ?? Prisma.DbNull,
            customValues: item.customValues ?? {},
            sketches: {
              create: sketches.map((s) => ({ assetId: s.assetId, sortOrder: s.sortOrder })),
            },
          }),
        ),
      },
    },
    select: { id: true },
  });
}

export async function deleteLesson(viewer: Viewer, id: string) {
  const lesson = await db.lesson.findFirst({
    where: { AND: [visibleLessonsWhere(viewer), { id }] },
    select: { teamId: true, items: { select: { sketches: { select: { assetId: true } } } } },
  });
  if (!lesson) throw new ActionFailure("notFound");
  if (!canCoach(viewer.teams, lesson.teamId)) throw teamForbidden();
  await db.lesson.delete({ where: { id } });
  await cleanupImages(lesson.items.flatMap((i) => i.sketches.map((s) => s.assetId)));
}

// ---------------------------------------------------------------------------
// Save the whole lesson document
// ---------------------------------------------------------------------------

async function assertAllInClub(count: Promise<number>, ids: Set<string>, code: string) {
  if ((await count) !== ids.size) throw new ActionFailure("validation", code);
}

/**
 * Saves general info and all items in one transaction. Every reference is
 * checked against the club; archived teams/coaches are accepted only if the
 * lesson already used them (old lessons stay editable).
 */
export async function saveLesson(viewer: Viewer, input: LessonSaveInput) {
  const clubId = viewer.clubId;
  const current = await db.lesson.findFirst({
    where: { AND: [visibleLessonsWhere(viewer), { id: input.id }] },
    select: {
      updatedAt: true,
      teamId: true,
      presentCoaches: { select: { coachId: true } },
      items: {
        select: {
          responsibleCoachId: true,
          sourceBlockId: true,
          sketches: { select: { assetId: true } },
          customValues: true,
        },
      },
    },
  });
  if (!current) throw new ActionFailure("notFound");
  // Only coaches of the lesson's team edit it, and only move it to teams they coach.
  if (!canCoach(viewer.teams, current.teamId) || !canCoach(viewer.teams, input.lesson.teamId)) {
    throw teamForbidden();
  }
  if (current.updatedAt.toISOString() !== input.baseVersion) {
    throw new ActionFailure("conflict", "lessonChanged");
  }

  const { lesson, items } = input;
  const usedCoachIds = new Set([
    ...current.presentCoaches.map((c) => c.coachId),
    ...current.items.map((i) => i.responsibleCoachId).filter((x): x is string => Boolean(x)),
  ]);

  // Team: active, or the one the lesson already had.
  if (lesson.teamId && lesson.teamId !== current.teamId) {
    await assertAllInClub(
      db.team.count({ where: { clubId, archivedAt: null, id: lesson.teamId } }),
      new Set([lesson.teamId]),
      "unknownTeam",
    );
  } else if (lesson.teamId) {
    await assertAllInClub(
      db.team.count({ where: { clubId, id: lesson.teamId } }),
      new Set([lesson.teamId]),
      "unknownTeam",
    );
  }
  if (lesson.layoutId) {
    await assertAllInClub(
      db.layout.count({ where: { clubId, id: lesson.layoutId } }),
      new Set([lesson.layoutId]),
      "unknownLayout",
    );
  }

  const coachIds = new Set([
    ...lesson.presentCoachIds,
    ...items.flatMap((i) => (i.responsible.kind === "coach" ? [i.responsible.coachId] : [])),
  ]);
  const newCoachIds = [...coachIds].filter((id) => !usedCoachIds.has(id));
  await Promise.all([
    assertAllInClub(
      db.coach.count({ where: { clubId, id: { in: [...coachIds] } } }),
      coachIds,
      "unknownCoach",
    ),
    assertAllInClub(
      db.coach.count({ where: { clubId, archivedAt: null, id: { in: newCoachIds } } }),
      new Set(newCoachIds),
      "unknownCoach",
    ),
    assertAllInClub(
      db.section.count({
        where: { clubId, id: { in: [...new Set(items.map((i) => i.sectionId))] } },
      }),
      new Set(items.map((i) => i.sectionId)),
      "unknownSection",
    ),
    requireClubAssets(clubId, [...new Set(items.flatMap((i) => i.sketchAssetIds))]),
  ]);

  // Links to library blocks: blocks deleted meanwhile simply lose the link.
  const sourceIds = [
    ...new Set(items.map((i) => i.sourceBlockId).filter((x): x is string => Boolean(x))),
  ];
  const existingSources = new Set(
    (
      await db.programBlock.findMany({
        where: { clubId, id: { in: sourceIds } },
        select: { id: true },
      })
    ).map((b) => b.id),
  );

  // Custom values: any field of the club (archived ones stay in old snapshots).
  const fields = await db.customField.findMany({
    where: { clubId },
    select: { id: true, type: true },
  });
  const valuesSchema = customValuesSchema(fields);
  const customValues = items.map((item, index) => {
    const parsed = valuesSchema.safeParse(item.customValues);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        Object.entries(toFieldErrors(parsed.error)).map(([k, v]) => [
          `items.${index}.customValues.${k}`,
          v,
        ]),
      );
      throw new ActionFailure("validation", undefined, fieldErrors);
    }
    return Object.fromEntries(
      Object.entries(parsed.data as Record<string, unknown>).filter(
        ([, v]) => v !== null && v !== undefined,
      ),
    );
  });
  const imageFieldIds = new Set(fields.filter((f) => f.type === "IMAGE").map((f) => f.id));
  await requireClubAssets(
    clubId,
    customValues.flatMap((v) =>
      Object.entries(v)
        .filter(([id, value]) => imageFieldIds.has(id) && typeof value === "string")
        .map(([, value]) => value as string),
    ),
  );

  const sortBySection = new Map<string, number>();
  const rows = items.map((item, index) => {
    const sortOrder = sortBySection.get(item.sectionId) ?? 0;
    sortBySection.set(item.sectionId, sortOrder + 1);
    return {
      id: item.id,
      sectionId: item.sectionId,
      sortOrder,
      sourceBlockId:
        item.sourceBlockId && existingSources.has(item.sourceBlockId) ? item.sourceBlockId : null,
      modifiedLocally: item.sourceBlockId ? item.modifiedLocally : false,
      ...itemContentData(item),
      ...responsibleData(item.responsible),
      customValues: customValues[index] as Prisma.InputJsonValue,
      sketches: { create: item.sketchAssetIds.map((assetId, i) => ({ assetId, sortOrder: i })) },
    };
  });

  const saved = await db.$transaction(async (tx) => {
    await tx.lessonItem.deleteMany({ where: { lessonId: input.id } });
    await tx.lessonCoach.deleteMany({ where: { lessonId: input.id } });
    return tx.lesson.update({
      where: { id: input.id },
      data: {
        title: lesson.title,
        authorName: lesson.authorName,
        date: new Date(`${lesson.date}T00:00:00Z`),
        teamId: lesson.teamId,
        layoutId: lesson.layoutId,
        startTimeMinutes: lesson.startTime,
        totalDurationMinutes: lesson.totalDurationMinutes,
        location: lesson.location,
        ageMin: lesson.ageMin,
        ageMax: lesson.ageMax,
        groupSize: lesson.groupSize,
        difficulty: lesson.difficulty,
        safety: json(lesson.safety),
        goals: json(lesson.goals),
        notes: json(lesson.notes),
        status: lesson.status,
        presentCoaches: { create: lesson.presentCoachIds.map((coachId) => ({ coachId })) },
        items: { create: rows },
      },
      select: { updatedAt: true },
    });
  });

  // Images that were removed from items and are used nowhere else.
  const kept = new Set(items.flatMap((i) => i.sketchAssetIds));
  const previousImages = current.items.flatMap((i) => [
    ...i.sketches.map((s) => s.assetId),
    ...Object.values((i.customValues ?? {}) as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    ),
  ]);
  await cleanupImages(previousImages.filter((id) => !kept.has(id)));

  return { version: saved.updatedAt.toISOString() };
}

function itemContentData(item: BlockContent) {
  return {
    title: item.title,
    durationMinutes: item.durationMinutes,
    description: json(item.description),
    rules: json(item.rules),
    variations: item.variations,
    organization: json(item.organization),
    material: item.material,
    teamCount: item.teamCount,
    minParticipants: item.minParticipants,
    maxParticipants: item.maxParticipants,
  };
}

function responsibleData(responsible: Responsible) {
  return {
    responsibleCoachId: responsible.kind === "coach" ? responsible.coachId : null,
    responsibleText: responsible.kind === "text" ? responsible.text : null,
  };
}

// ---------------------------------------------------------------------------
// Bridge between lesson items and the library
// ---------------------------------------------------------------------------

/** The content of a library block, ready to become a lesson item. */
export async function snapshotFromBlock(viewer: Viewer, blockId: string) {
  const block = await getBlock(visibleBlocksWhere(viewer), blockId);
  if (!block) throw new ActionFailure("notFound");
  return {
    sourceBlockId: block.id,
    suggestedSectionId: block.suggestedSectionId,
    title: block.title,
    durationMinutes: block.durationMinutes === null ? "" : String(block.durationMinutes),
    description: block.description as RichText | null,
    rules: block.rules as RichText | null,
    variations: block.variations,
    organization: block.organization as RichText | null,
    material: block.material,
    sketchAssetIds: block.sketches.map((s) => s.assetId),
    teamCount: block.teamCount === null ? "" : String(block.teamCount),
    minParticipants: block.minParticipants === null ? "" : String(block.minParticipants),
    maxParticipants: block.maxParticipants === null ? "" : String(block.maxParticipants),
    customValues: (block.customValues ?? {}) as Record<string, unknown>,
  };
}

async function activeFieldIds(clubId: string) {
  return (
    await db.customField.findMany({ where: { clubId, archivedAt: null }, select: { id: true } })
  ).map((f) => f.id);
}

/** Content of an item as library input, keeping only active custom fields. */
function contentAsBlockValues(item: LessonItemInput, activeIds: string[]) {
  const n = (v: number | null) => (v === null ? "" : String(v));
  return {
    title: item.title,
    durationMinutes: n(item.durationMinutes),
    description: item.description,
    rules: item.rules,
    variations: item.variations,
    organization: item.organization,
    material: item.material,
    sketchAssetIds: item.sketchAssetIds,
    teamCount: n(item.teamCount),
    minParticipants: n(item.minParticipants),
    maxParticipants: n(item.maxParticipants),
    customValues: Object.fromEntries(
      Object.entries(item.customValues).filter(([id]) => activeIds.includes(id)),
    ),
  };
}

function parseBlockInput(values: unknown) {
  const parsed = blockInputSchema.safeParse(values);
  if (!parsed.success)
    throw new ActionFailure("validation", undefined, toFieldErrors(parsed.error));
  return parsed.data;
}

/**
 * "Gespeicherten Programmblock überschreiben": the block's content becomes the
 * item's content; its categories, teams, section, age and difficulty stay.
 */
export async function overwriteBlockFromItem(
  viewer: Viewer,
  blockId: string,
  item: LessonItemInput,
) {
  const clubId = viewer.clubId;
  const block = await getBlock(visibleBlocksWhere(viewer), blockId);
  if (!block) throw new ActionFailure("notFound");
  const ids = await activeFieldIds(clubId);
  const input = parseBlockInput({
    ...blockToFormValues(block, ids),
    ...contentAsBlockValues(item, ids),
  });
  return updateBlock(viewer, blockId, input);
}

/**
 * "Als neuen Programmblock speichern": a new library block with the item's
 * content; categories, teams etc. are taken over from the source block.
 */
export async function createBlockFromItem(
  viewer: Viewer,
  item: LessonItemInput,
  sectionId: string,
) {
  const ids = await activeFieldIds(viewer.clubId);
  const source = item.sourceBlockId
    ? await getBlock(visibleBlocksWhere(viewer), item.sourceBlockId)
    : null;
  const meta = source
    ? blockToFormValues(source, ids)
    : {
        tagIds: [],
        teamIds: [],
        suggestedSectionId: sectionId,
        ageMin: "",
        ageMax: "",
        difficulty: null,
      };
  const input = parseBlockInput({
    ...meta,
    // Only teams the person coaches carry over to the new block.
    teamIds: meta.teamIds.filter((teamId) => canCoach(viewer.teams, teamId)),
    ...contentAsBlockValues(item, ids),
  });
  return createBlock(viewer, input);
}
