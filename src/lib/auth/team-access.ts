import type { Role, TeamRole } from "@/generated/prisma/enums";

/**
 * What someone may do per team (Riege). Admins have every team as COACH.
 * Everyone else has a role for all teams (`all`, incl. teams created
 * later) or per team (`teams`); teams without a role are invisible.
 */
export type TeamAccess = {
  admin: boolean;
  all: TeamRole | null;
  teams: Readonly<Record<string, TeamRole>>;
};

export const ADMIN_ACCESS: TeamAccess = { admin: true, all: "COACH", teams: {} };

export function teamAccessOf(membership: {
  role: Role;
  allTeamsRole: TeamRole | null;
  teams: { teamId: string; role: TeamRole }[];
}): TeamAccess {
  if (membership.role === "ADMIN") return ADMIN_ACCESS;
  return {
    admin: false,
    all: membership.allTeamsRole,
    teams: Object.fromEntries(membership.teams.map((t) => [t.teamId, t.role])),
  };
}

/** True if the person coaches at least one team (or all). */
export function coachesAnywhere(access: TeamAccess): boolean {
  return access.all === "COACH" || Object.values(access.teams).includes("COACH");
}

/**
 * Role for something belonging to a team. Club-wide things (no team) are
 * visible to every member and editable by everyone who coaches anywhere.
 */
export function roleFor(access: TeamAccess, teamId: string | null): TeamRole | null {
  if (teamId === null) return coachesAnywhere(access) ? "COACH" : "READER";
  return access.all ?? access.teams[teamId] ?? null;
}

export const canCoach = (access: TeamAccess, teamId: string | null) =>
  roleFor(access, teamId) === "COACH";

/** Team ids the person may see; null = all teams. */
export function visibleTeamIds(access: TeamAccess): string[] | null {
  return access.all ? null : Object.keys(access.teams);
}

/** Team ids the person coaches; null = all teams. */
export function coachedTeamIds(access: TeamAccess): string[] | null {
  if (access.all === "COACH") return null;
  return Object.entries(access.teams)
    .filter(([, role]) => role === "COACH")
    .map(([id]) => id);
}

/** Block teams: club-wide (empty) or one of them visible. */
export function canSeeBlock(access: TeamAccess, blockTeamIds: string[]): boolean {
  return blockTeamIds.length === 0 || blockTeamIds.some((id) => roleFor(access, id) !== null);
}

/**
 * A block may be edited by whoever coaches one of its teams (club-wide:
 * anyone who coaches). Team assignments can only be added or removed for
 * teams the person coaches, so nobody takes a block away from other teams.
 */
export function canEditBlock(access: TeamAccess, blockTeamIds: string[]): boolean {
  return blockTeamIds.length === 0
    ? coachesAnywhere(access)
    : blockTeamIds.some((id) => canCoach(access, id));
}

export function canChangeBlockTeams(
  access: TeamAccess,
  before: string[],
  after: string[],
): boolean {
  const changed = [
    ...after.filter((id) => !before.includes(id)),
    ...before.filter((id) => !after.includes(id)),
  ];
  return changed.every((id) => canCoach(access, id));
}

/**
 * The summary role stored on the membership: ADMIN, COACH as soon as one
 * team is coached, otherwise READER (reader quota, coarse UI checks).
 */
export function summaryRole(
  admin: boolean,
  allTeamsRole: TeamRole | null,
  teams: { role: TeamRole }[],
): Role {
  if (admin) return "ADMIN";
  return allTeamsRole === "COACH" || teams.some((t) => t.role === "COACH") ? "COACH" : "READER";
}

/** Access as edited in the people settings (see accessSchema). */
export type AccessValue =
  | { kind: "admin" }
  | { kind: "all"; role: TeamRole }
  | { kind: "teams"; teams: { teamId: string; role: TeamRole }[] };

/** Form value → what is stored on Membership / Invitation. */
export function accessRecords(access: AccessValue): {
  role: Role;
  allTeamsRole: TeamRole | null;
  teams: { teamId: string; role: TeamRole }[];
} {
  if (access.kind === "admin") return { role: "ADMIN", allTeamsRole: null, teams: [] };
  if (access.kind === "all") {
    return { role: summaryRole(false, access.role, []), allTeamsRole: access.role, teams: [] };
  }
  return { role: summaryRole(false, null, access.teams), allTeamsRole: null, teams: access.teams };
}

/** Stored Membership / Invitation → form value. */
export function accessValueOf(record: {
  role: Role;
  allTeamsRole: TeamRole | null;
  teams: { teamId: string; role: TeamRole }[];
}): AccessValue {
  if (record.role === "ADMIN") return { kind: "admin" };
  if (record.allTeamsRole) return { kind: "all", role: record.allTeamsRole };
  if (record.teams.length > 0) {
    return { kind: "teams", teams: record.teams.map(({ teamId, role }) => ({ teamId, role })) };
  }
  // Every team the person had was deleted: nothing visible until reassigned.
  return { kind: "teams", teams: [] };
}
