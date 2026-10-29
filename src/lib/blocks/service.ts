import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { deleteAssetIfUnused, requireClubAssets } from "@/lib/assets/service";
import { db } from "@/lib/db";
import type { RichText } from "@/lib/rich-text/schema";
import { isRichTextEmpty } from "@/lib/rich-text/utils";
import { ActionFailure, toFieldErrors } from "@/lib/server/result";
import { imageAssetIds, mergeCustomValues, searchableCustomTexts } from "./custom-values";
import { customValuesSchema, type BlockInput } from "./schema";
import { buildSearchText } from "./search-text";

const richOrNull = (doc: RichText | null) => (doc && !isRichTextEmpty(doc) ? doc : null);
const jsonOrNull = (doc: RichText | null) => doc ?? Prisma.DbNull;

async function assertCount(count: Promise<number>, expected: number, code: string) {
  if ((await count) !== expected) throw new ActionFailure("validation", code);
}

/**
 * Checks that every reference belongs to the club (and is active where that
 * matters), validates custom values against the field definitions and
 * returns the data to store.
 */
async function prepare(
  clubId: string,
  input: BlockInput,
  storedCustomValues: Record<string, unknown>,
) {
  const coachId = input.responsible.kind === "coach" ? input.responsible.coachId : null;
  await Promise.all([
    assertCount(
      db.tag.count({ where: { clubId, id: { in: input.tagIds } } }),
      input.tagIds.length,
      "unknownTag",
    ),
    assertCount(
      db.team.count({ where: { clubId, archivedAt: null, id: { in: input.teamIds } } }),
      input.teamIds.length,
      "unknownTeam",
    ),
    input.suggestedSectionId
      ? assertCount(
          db.section.count({ where: { clubId, id: input.suggestedSectionId } }),
          1,
          "unknownSection",
        )
      : null,
    coachId
      ? assertCount(
          db.coach.count({ where: { clubId, archivedAt: null, id: coachId } }),
          1,
          "unknownCoach",
        )
      : null,
    requireClubAssets(clubId, input.sketchAssetIds),
  ]);

  const fields = await db.customField.findMany({
    where: { clubId, archivedAt: null },
    select: { id: true, type: true, searchable: true },
  });
  const parsedValues = customValuesSchema(fields).safeParse(input.customValues);
  if (!parsedValues.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(toFieldErrors(parsedValues.error)).map(([k, v]) => [`customValues.${k}`, v]),
    );
    throw new ActionFailure("validation", undefined, fieldErrors);
  }
  const values = Object.fromEntries(
    Object.entries(parsedValues.data as Record<string, unknown>).map(([id, v]) => [
      id,
      v && typeof v === "object" && "type" in v ? richOrNull(v as RichText) : v,
    ]),
  );
  const submitted = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null));
  await requireClubAssets(clubId, imageAssetIds(fields, submitted));
  const customValues = mergeCustomValues(
    new Set(fields.map((f) => f.id)),
    submitted,
    storedCustomValues,
  );

  const description = richOrNull(input.description);
  const rules = richOrNull(input.rules);
  const organization = richOrNull(input.organization);
  const responsibleText = input.responsible.kind === "text" ? input.responsible.text : null;

  return {
    scalars: {
      title: input.title,
      durationMinutes: input.durationMinutes,
      description: jsonOrNull(description),
      rules: jsonOrNull(rules),
      variations: input.variations,
      organization: jsonOrNull(organization),
      material: input.material,
      responsibleCoachId: coachId,
      responsibleText,
      suggestedSectionId: input.suggestedSectionId,
      ageMin: input.ageMin,
      ageMax: input.ageMax,
      difficulty: input.difficulty,
      customValues: customValues as Prisma.InputJsonValue,
      searchText: buildSearchText({
        title: input.title,
        description,
        rules,
        variations: input.variations,
        organization,
        material: input.material,
        responsibleText,
        customTexts: searchableCustomTexts(fields, customValues),
      }),
    },
    relations: {
      tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
      teams: { create: input.teamIds.map((teamId) => ({ teamId })) },
      sketches: {
        create: input.sketchAssetIds.map((assetId, sortOrder) => ({ assetId, sortOrder })),
      },
    },
    imageIds: [...input.sketchAssetIds, ...imageAssetIds(fields, customValues)],
  };
}

export async function createBlock(clubId: string, input: BlockInput) {
  const data = await prepare(clubId, input, {});
  return db.programBlock.create({
    data: { clubId, ...data.scalars, ...data.relations },
    select: { id: true },
  });
}

export async function updateBlock(clubId: string, id: string, input: BlockInput) {
  const existing = await db.programBlock.findFirst({
    where: { id, clubId },
    select: { customValues: true, sketches: { select: { assetId: true } } },
  });
  if (!existing) throw new ActionFailure("notFound");
  const stored = (existing.customValues ?? {}) as Record<string, unknown>;
  const data = await prepare(clubId, input, stored);

  await db.$transaction([
    db.programBlockTag.deleteMany({ where: { blockId: id } }),
    db.programBlockTeam.deleteMany({ where: { blockId: id } }),
    db.programBlockSketch.deleteMany({ where: { blockId: id } }),
    db.programBlock.update({ where: { id }, data: { ...data.scalars, ...data.relations } }),
  ]);

  const previous = [
    ...existing.sketches.map((s) => s.assetId),
    ...Object.values(stored).filter((v): v is string => typeof v === "string"),
  ];
  await cleanupImages(previous.filter((assetId) => !data.imageIds.includes(assetId)));
  return { id };
}

/** Copies a block incl. relations; images are shared (they are immutable). */
export async function duplicateBlock(clubId: string, id: string, titleSuffix: string) {
  const source = await db.programBlock.findFirst({
    where: { id, clubId },
    include: { tags: true, teams: true, sketches: true },
  });
  if (!source) throw new ActionFailure("notFound");
  const title = `${source.title} ${titleSuffix}`.slice(0, 150);
  return db.programBlock.create({
    data: {
      clubId,
      title,
      durationMinutes: source.durationMinutes,
      description: source.description ?? Prisma.DbNull,
      rules: source.rules ?? Prisma.DbNull,
      variations: source.variations,
      organization: source.organization ?? Prisma.DbNull,
      material: source.material,
      responsibleCoachId: source.responsibleCoachId,
      responsibleText: source.responsibleText,
      suggestedSectionId: source.suggestedSectionId,
      ageMin: source.ageMin,
      ageMax: source.ageMax,
      difficulty: source.difficulty,
      customValues: source.customValues ?? {},
      searchText: source.searchText.replace(source.title, title),
      tags: { create: source.tags.map((t) => ({ tagId: t.tagId })) },
      teams: { create: source.teams.map((t) => ({ teamId: t.teamId })) },
      sketches: {
        create: source.sketches.map((s) => ({ assetId: s.assetId, sortOrder: s.sortOrder })),
      },
    },
    select: { id: true },
  });
}

/** Lessons keep their copies; their link to the library block is cleared. */
export async function deleteBlock(clubId: string, id: string) {
  const block = await db.programBlock.findFirst({
    where: { id, clubId },
    select: { customValues: true, sketches: { select: { assetId: true } } },
  });
  if (!block) throw new ActionFailure("notFound");
  await db.programBlock.delete({ where: { id } });
  const images = [
    ...block.sketches.map((s) => s.assetId),
    ...Object.values((block.customValues ?? {}) as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    ),
  ];
  await cleanupImages(images);
}

async function cleanupImages(ids: string[]) {
  const uuid = /^[0-9a-f-]{36}$/;
  for (const id of new Set(ids)) if (uuid.test(id)) await deleteAssetIfUnused(id);
}
