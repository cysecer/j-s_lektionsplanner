import "server-only";
import { db } from "@/lib/db";
import { listMaterials } from "@/lib/blocks/queries";

export const LESSONS_PAGE_SIZE = 20;

/** Lessons of the club, newest first, optionally limited to a team. */
export async function listLessons(
  clubId: string,
  options: { teamId: string | null; page: number },
) {
  const where = { clubId, ...(options.teamId ? { teamId: options.teamId } : {}) };
  const [total, lessons] = await Promise.all([
    db.lesson.count({ where }),
    db.lesson.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (options.page - 1) * LESSONS_PAGE_SIZE,
      take: LESSONS_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        totalDurationMinutes: true,
        team: { select: { name: true } },
        items: { select: { durationMinutes: true } },
      },
    }),
  ]);
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / LESSONS_PAGE_SIZE)),
    lessons: lessons.map(({ items, ...l }) => ({
      ...l,
      itemCount: items.length,
      plannedMinutes: items.reduce((sum, i) => sum + (i.durationMinutes ?? 0), 0),
    })),
  };
}

/** A lesson with its items in display order (section order, then item order). */
export async function getLesson(clubId: string, id: string) {
  const lesson = await db.lesson.findFirst({
    where: { id, clubId },
    include: {
      team: { select: { id: true, name: true } },
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
      select: { id: true, name: true },
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
