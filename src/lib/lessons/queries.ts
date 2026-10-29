import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Viewer } from "@/lib/auth/session";
import { listMaterials } from "@/lib/blocks/queries";
import { escapeLike } from "@/lib/blocks/search-params";
import { todayInZurich } from "./service";
import { visibleLessonsWhere } from "./visibility";

export const LESSONS_PAGE_SIZE = 25;

export type LessonListFilter = {
  teamId: string | null;
  /** Upcoming: today and later, soonest first. Past: before today, newest first. */
  when: "upcoming" | "past";
  q?: string;
  /** ISO dates, inclusive. */
  from?: string;
  to?: string;
  page: number;
};

/**
 * Lessons whose title or goals ("Zielsetzungen / Lernziele") contain the
 * text. Goals are rich text (JSON): only its text nodes are searched.
 */
async function lessonIdsMatching(clubId: string, q: string): Promise<string[]> {
  const like = `%${escapeLike(q.toLowerCase())}%`;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT l.id FROM "Lesson" l
    WHERE l."clubId" = ${clubId}::uuid
      AND (
        lower(l.title) LIKE ${like} ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM jsonb_path_query(l.goals, 'strict $.**.text') AS node(value)
          WHERE lower(node.value #>> '{}') LIKE ${like} ESCAPE '\\'
        )
      )`;
  return rows.map((r) => r.id);
}

/**
 * The lessons a person may see (visibleLessonsWhere), filtered, split into
 * upcoming and past. Returns the page of the chosen tab and both counts.
 */
export async function listLessons(viewer: Viewer, filter: LessonListFilter) {
  const today = todayInZurich();
  const ids = filter.q ? await lessonIdsMatching(viewer.clubId, filter.q) : null;
  const base: Prisma.LessonWhereInput[] = [
    visibleLessonsWhere(viewer),
    filter.teamId ? { teamId: filter.teamId } : {},
    filter.from ? { date: { gte: new Date(`${filter.from}T00:00:00Z`) } } : {},
    filter.to ? { date: { lte: new Date(`${filter.to}T00:00:00Z`) } } : {},
    ids ? { id: { in: ids } } : {},
  ];
  const upcoming = { AND: [...base, { date: { gte: today } }] };
  const past = { AND: [...base, { date: { lt: today } }] };
  const where = filter.when === "upcoming" ? upcoming : past;
  const order = filter.when === "upcoming" ? "asc" : "desc";

  const [upcomingCount, pastCount, lessons] = await Promise.all([
    db.lesson.count({ where: upcoming }),
    db.lesson.count({ where: past }),
    db.lesson.findMany({
      where,
      orderBy: [{ date: order }, { startTimeMinutes: order }, { createdAt: order }],
      skip: (filter.page - 1) * LESSONS_PAGE_SIZE,
      take: LESSONS_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        startTimeMinutes: true,
        team: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: { select: { durationMinutes: true } },
      },
    }),
  ]);
  const total = filter.when === "upcoming" ? upcomingCount : pastCount;
  return {
    total,
    counts: { upcoming: upcomingCount, past: pastCount },
    pageCount: Math.max(1, Math.ceil(total / LESSONS_PAGE_SIZE)),
    lessons: lessons.map(({ items, createdBy, ...l }) => ({
      ...l,
      createdByName: createdBy?.name ?? null,
      itemCount: items.length,
      plannedMinutes: items.reduce((sum, i) => sum + (i.durationMinutes ?? 0), 0),
    })),
  };
}

/**
 * A lesson with its items in display order (section order, then item order).
 * `scope` limits the lookup: the club, or what a person may see
 * (visibleLessonsWhere).
 */
export async function getLesson(scope: Prisma.LessonWhereInput & { clubId: string }, id: string) {
  const lesson = await db.lesson.findFirst({
    where: { AND: [scope, { id }] },
    include: {
      team: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      presentCoaches: { select: { coachId: true } },
      items: {
        orderBy: [{ section: { sortOrder: "asc" } }, { sortOrder: "asc" }],
        include: {
          sketches: { orderBy: { sortOrder: "asc" }, select: { assetId: true } },
          responsibleCoach: { select: { name: true } },
        },
      },
    },
  });
  return lesson;
}

/** Choices for the lesson editor. Archived entries only if the lesson uses them. */
export async function getLessonOptions(
  clubId: string,
  usedTeamId: string | null,
  usedCoachIds: string[],
) {
  const [teams, coaches, sections, layouts, fields, tags, materials] = await Promise.all([
    db.team.findMany({
      where: { clubId, OR: [{ archivedAt: null }, ...(usedTeamId ? [{ id: usedTeamId }] : [])] },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, privateDrafts: true },
    }),
    db.coach.findMany({
      where: { clubId, OR: [{ archivedAt: null }, { id: { in: usedCoachIds } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, teams: { select: { teamId: true } } },
    }),
    db.section.findMany({
      where: { clubId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, builtin: true, name: true },
    }),
    db.layout.findMany({
      where: { clubId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // All fields: item snapshots may hold values of archived ones.
    db.customField.findMany({
      where: { clubId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, type: true, archivedAt: true },
    }),
    db.tag.findMany({
      where: { clubId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listMaterials(clubId),
  ]);
  return {
    teams,
    coaches: coaches.map((c) => ({
      id: c.id,
      name: c.name,
      teamIds: c.teams.map((t) => t.teamId),
    })),
    sections,
    layouts,
    fields: fields.map(({ archivedAt, ...f }) => ({ ...f, archived: archivedAt !== null })),
    tags,
    materials,
  };
}

export type LessonOptions = Awaited<ReturnType<typeof getLessonOptions>>;
