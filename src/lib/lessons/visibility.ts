import { Prisma } from "@/generated/prisma/client";
import { visibleTeamIds, type TeamAccess } from "@/lib/auth/team-access";

type Who = { clubId: string; userId: string; teams: TeamAccess };

/**
 * Which lessons someone may see:
 * - only lessons of teams they have a role in (lessons without team: all);
 * - in teams with private drafts, a draft only for its creator until it
 *   is published (status FINAL).
 * Admins see everything. Lessons without recorded creator stay visible,
 * as before private drafts existed.
 *
 * Every lesson lookup on behalf of a person goes through this filter.
 */
export function visibleLessonsWhere(who: Who): Prisma.LessonWhereInput & { clubId: string } {
  if (who.teams.admin) return { clubId: who.clubId };
  const teamIds = visibleTeamIds(who.teams);
  return {
    clubId: who.clubId,
    AND: [
      ...(teamIds ? [{ OR: [{ teamId: null }, { teamId: { in: teamIds } }] }] : []),
      {
        OR: [
          { status: "FINAL" },
          { createdById: who.userId },
          { createdById: null },
          { teamId: null },
          { team: { privateDrafts: false } },
        ],
      },
    ],
  };
}

/** Active teams someone has a role in (admins: all). */
export function visibleTeamsWhere(who: Who): Prisma.TeamWhereInput {
  const teamIds = visibleTeamIds(who.teams);
  return { clubId: who.clubId, archivedAt: null, ...(teamIds ? { id: { in: teamIds } } : {}) };
}

/** Program blocks someone may see: club-wide ones and those of their teams. */
export function visibleBlocksWhere(who: Who): Prisma.ProgramBlockWhereInput & { clubId: string } {
  const teamIds = visibleTeamIds(who.teams);
  if (!teamIds) return { clubId: who.clubId };
  return {
    clubId: who.clubId,
    OR: [{ teams: { none: {} } }, { teams: { some: { teamId: { in: teamIds } } } }],
  };
}

/** The same rule for raw SQL on "ProgramBlock" aliased as `b`. */
export function visibleBlocksSql(teams: TeamAccess): Prisma.Sql | null {
  const teamIds = visibleTeamIds(teams);
  if (!teamIds) return null;
  return Prisma.sql`(
    NOT EXISTS (SELECT 1 FROM "ProgramBlockTeam" vt WHERE vt."blockId" = b.id)
    OR EXISTS (
      SELECT 1 FROM "ProgramBlockTeam" vt
      WHERE vt."blockId" = b.id AND vt."teamId" = ANY(${teamIds}::uuid[])
    )
  )`;
}
