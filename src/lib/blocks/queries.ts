import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { coachedTeamIds, visibleTeamIds, type TeamAccess } from "@/lib/auth/team-access";
import { db } from "@/lib/db";
import { visibleBlocksSql } from "@/lib/lessons/visibility";
import {
  BLOCKS_PAGE_SIZE,
  escapeLike,
  materialSuggestions,
  type BlockSearch,
  type BlockSort,
} from "./search-params";

export type BlockListItem = Awaited<ReturnType<typeof searchBlocks>>["items"][number];

/**
 * Library search: German full-text OR substring match, filters, sorting and
 * usage statistics. All user values are bound parameters (Prisma.sql).
 */
export async function searchBlocks(
  clubId: string,
  teams: TeamAccess,
  search: BlockSearch & { teamId: string | null },
) {
  const conditions: Prisma.Sql[] = [Prisma.sql`b."clubId" = ${clubId}::uuid`];
  // Only blocks of the person's teams (and club-wide ones).
  const visible = visibleBlocksSql(teams);
  if (visible) conditions.push(visible);

  if (search.q) {
    const like = `%${escapeLike(search.q.toLowerCase())}%`;
    conditions.push(Prisma.sql`(
      to_tsvector('german', b."searchText") @@ websearch_to_tsquery('german', ${search.q})
      OR lower(b."searchText") LIKE ${like} ESCAPE '\\'
    )`);
  }
  if (search.material) {
    // Stemmed per entry, so plural and singular match; substring for partial words.
    const like = `%${escapeLike(search.material.toLowerCase())}%`;
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM unnest(b.material) m
      WHERE to_tsvector('german', m) @@ plainto_tsquery('german', ${search.material})
         OR lower(m) LIKE ${like} ESCAPE '\\'
    )`);
  }
  if (search.teamId) {
    // Club-wide blocks (no team) are available to every team.
    conditions.push(Prisma.sql`(
      NOT EXISTS (SELECT 1 FROM "ProgramBlockTeam" t WHERE t."blockId" = b.id)
      OR EXISTS (SELECT 1 FROM "ProgramBlockTeam" t WHERE t."blockId" = b.id AND t."teamId" = ${search.teamId}::uuid)
    )`);
  }
  if (search.tags?.length) {
    conditions.push(Prisma.sql`(
      SELECT count(*) FROM "ProgramBlockTag" pt
      WHERE pt."blockId" = b.id AND pt."tagId" = ANY(${search.tags}::uuid[])
    ) = ${search.tags.length}`);
  }
  if (search.section) conditions.push(Prisma.sql`b."suggestedSectionId" = ${search.section}::uuid`);
  if (search.durMin !== undefined)
    conditions.push(Prisma.sql`b."durationMinutes" >= ${search.durMin}`);
  if (search.durMax !== undefined)
    conditions.push(Prisma.sql`b."durationMinutes" <= ${search.durMax}`);
  if (search.difficulty) {
    conditions.push(Prisma.sql`b."difficulty" = ${search.difficulty}::"Difficulty"`);
  }
  if (search.age !== undefined) {
    conditions.push(Prisma.sql`(b."ageMin" IS NULL OR b."ageMin" <= ${search.age})`);
    conditions.push(Prisma.sql`(b."ageMax" IS NULL OR b."ageMax" >= ${search.age})`);
  }
  if (search.kids !== undefined) {
    conditions.push(
      Prisma.sql`(b."minParticipants" IS NULL OR b."minParticipants" <= ${search.kids})`,
    );
    conditions.push(
      Prisma.sql`(b."maxParticipants" IS NULL OR b."maxParticipants" >= ${search.kids})`,
    );
  }
  if (search.teamCount !== undefined) {
    conditions.push(Prisma.sql`b."teamCount" = ${search.teamCount}`);
  }

  const sort: BlockSort = search.sort ?? (search.q ? "relevance" : "name");
  const orderBy: Record<BlockSort, Prisma.Sql> = {
    relevance: search.q
      ? Prisma.sql`(lower(b.title) LIKE ${`%${escapeLike(search.q.toLowerCase())}%`} ESCAPE '\\') DESC,
          ts_rank(to_tsvector('german', b."searchText"), websearch_to_tsquery('german', ${search.q})) DESC,
          lower(b.title) ASC`
      : Prisma.sql`lower(b.title) ASC`,
    name: Prisma.sql`lower(b.title) ASC`,
    duration: Prisma.sql`b."durationMinutes" ASC NULLS LAST, lower(b.title) ASC`,
    lastUsed: Prisma.sql`u.last_used DESC NULLS LAST, lower(b.title) ASC`,
    mostUsed: Prisma.sql`u.use_count DESC, lower(b.title) ASC`,
  };

  const page = search.page ?? 1;
  const rows = await db.$queryRaw<
    { id: string; use_count: bigint; last_used: Date | null; total: bigint }[]
  >`
    SELECT b.id, u.use_count, u.last_used, count(*) OVER() AS total
    FROM "ProgramBlock" b
    LEFT JOIN LATERAL (
      SELECT count(*) AS use_count, max(l.date) AS last_used
      FROM "LessonItem" i JOIN "Lesson" l ON l.id = i."lessonId"
      WHERE i."sourceBlockId" = b.id
    ) u ON true
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY ${orderBy[sort]}
    LIMIT ${BLOCKS_PAGE_SIZE} OFFSET ${(page - 1) * BLOCKS_PAGE_SIZE}`;

  const details = await db.programBlock.findMany({
    where: { id: { in: rows.map((r) => r.id) }, clubId },
    select: {
      id: true,
      title: true,
      durationMinutes: true,
      difficulty: true,
      ageMin: true,
      ageMax: true,
      teamCount: true,
      minParticipants: true,
      maxParticipants: true,
      material: true,
      suggestedSection: { select: { builtin: true, name: true } },
      tags: { select: { tag: { select: { id: true, name: true } } } },
      teams: { select: { team: { select: { id: true, name: true } } } },
      sketches: { orderBy: { sortOrder: "asc" }, take: 1, select: { assetId: true } },
    },
  });
  const byId = new Map(details.map((d) => [d.id, d]));

  return {
    total: Number(rows[0]?.total ?? 0),
    page,
    pageCount: Math.max(1, Math.ceil(Number(rows[0]?.total ?? 0) / BLOCKS_PAGE_SIZE)),
    sort,
    items: rows
      .filter((r) => byId.has(r.id))
      .map((r) => {
        const d = byId.get(r.id)!;
        return {
          ...d,
          tags: d.tags.map((x) => x.tag),
          teams: d.teams.map((x) => x.team),
          thumbnailAssetId: d.sketches[0]?.assetId ?? null,
          useCount: Number(r.use_count),
          lastUsed: r.last_used,
        };
      }),
  };
}

/**
 * Everything the block detail and editor pages need. `scope` is the club
 * or what a person may see (visibleBlocksWhere).
 */
export async function getBlock(
  scope: Prisma.ProgramBlockWhereInput & { clubId: string },
  id: string,
) {
  return db.programBlock.findFirst({
    where: { AND: [scope, { id }] },
    include: {
      tags: { select: { tagId: true, tag: { select: { name: true } } } },
      teams: { select: { teamId: true, team: { select: { name: true } } } },
      sketches: { orderBy: { sortOrder: "asc" }, select: { assetId: true } },
      suggestedSection: { select: { id: true, builtin: true, name: true } },
    },
  });
}

/** Lessons that contain a copy of the block (newest first). */
export async function getBlockUsage(scope: Prisma.LessonWhereInput, blockId: string) {
  return db.lesson.findMany({
    where: { AND: [scope, { items: { some: { sourceBlockId: blockId } } }] },
    orderBy: { date: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      date: true,
      team: { select: { name: true } },
      items: { where: { sourceBlockId: blockId }, select: { modifiedLocally: true } },
    },
  });
}

/** Options for filters and the editor (active entries only). */
/** Material names used in the club's blocks, as suggestions for the material filter. */
export async function listMaterials(clubId: string) {
  const rows = await db.$queryRaw<{ m: string }[]>`
    SELECT DISTINCT m FROM "ProgramBlock" b, unnest(b.material) m
    WHERE b."clubId" = ${clubId}::uuid
    LIMIT 2000`;
  return materialSuggestions(rows.map((r) => r.m));
}

/**
 * Choices for block filters and the block form. `purpose: "edit"` offers
 * only the teams the person coaches (blocks can be assigned to those).
 */
export async function getBlockOptions(
  clubId: string,
  access: TeamAccess,
  purpose: "filter" | "edit" = "filter",
) {
  const teamIds = purpose === "edit" ? coachedTeamIds(access) : visibleTeamIds(access);
  const [tags, teams, sections, fields, materials] = await Promise.all([
    db.tag.findMany({
      where: { clubId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.team.findMany({
      where: { clubId, archivedAt: null, ...(teamIds ? { id: { in: teamIds } } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.section.findMany({
      where: { clubId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, builtin: true, name: true },
    }),
    db.customField.findMany({
      where: { clubId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, type: true, searchable: true, filterable: true },
    }),
    listMaterials(clubId),
  ]);
  return { tags, teams, sections, fields, materials };
}
