import { describe, expect, it } from "vitest";
import {
  ADMIN_ACCESS,
  accessRecords,
  accessValueOf,
  canChangeBlockTeams,
  canCoach,
  canEditBlock,
  canSeeBlock,
  coachedTeamIds,
  roleFor,
  summaryRole,
  teamAccessOf,
  visibleTeamIds,
} from "./team-access";

const KIDS = "kids";
const JUGI = "jugi";
const TUVO = "tuvo";

// Leiterin in Kids, liest in Jugi, sieht TuVo nicht.
const mixed = teamAccessOf({
  role: "COACH",
  allTeamsRole: null,
  teams: [
    { teamId: KIDS, role: "COACH" },
    { teamId: JUGI, role: "READER" },
  ],
});
const readerOnly = teamAccessOf({
  role: "READER",
  allTeamsRole: null,
  teams: [{ teamId: JUGI, role: "READER" }],
});
const allCoach = teamAccessOf({ role: "COACH", allTeamsRole: "COACH", teams: [] });

describe("team access", () => {
  it("gives admins everything, regardless of stored team roles", () => {
    const admin = teamAccessOf({ role: "ADMIN", allTeamsRole: "READER", teams: [] });
    expect(admin).toBe(ADMIN_ACCESS);
    expect(canCoach(admin, TUVO)).toBe(true);
    expect(visibleTeamIds(admin)).toBeNull();
  });

  it("resolves roles per team; unassigned teams are invisible", () => {
    expect(roleFor(mixed, KIDS)).toBe("COACH");
    expect(roleFor(mixed, JUGI)).toBe("READER");
    expect(roleFor(mixed, TUVO)).toBeNull();
    expect(visibleTeamIds(mixed)?.sort()).toEqual([JUGI, KIDS]);
    expect(coachedTeamIds(mixed)).toEqual([KIDS]);
  });

  it("applies an all-teams role to every team, including new ones", () => {
    expect(roleFor(allCoach, "created-later")).toBe("COACH");
    expect(visibleTeamIds(allCoach)).toBeNull();
    expect(coachedTeamIds(allCoach)).toBeNull();
    const allRead = teamAccessOf({ role: "READER", allTeamsRole: "READER", teams: [] });
    expect(coachedTeamIds(allRead)).toEqual([]);
  });

  it("treats club-wide things as visible to all and editable by coaches", () => {
    expect(roleFor(mixed, null)).toBe("COACH");
    expect(roleFor(readerOnly, null)).toBe("READER");
  });

  it("decides block visibility and editing by the block's teams", () => {
    expect(canSeeBlock(readerOnly, [])).toBe(true);
    expect(canSeeBlock(readerOnly, [TUVO])).toBe(false);
    expect(canSeeBlock(readerOnly, [TUVO, JUGI])).toBe(true);
    expect(canEditBlock(readerOnly, [])).toBe(false);
    expect(canEditBlock(mixed, [])).toBe(true);
    expect(canEditBlock(mixed, [JUGI])).toBe(false);
    expect(canEditBlock(mixed, [JUGI, KIDS])).toBe(true);
  });

  it("only lets people change team assignments of teams they coach", () => {
    expect(canChangeBlockTeams(mixed, [JUGI], [JUGI, KIDS])).toBe(true);
    expect(canChangeBlockTeams(mixed, [JUGI, KIDS], [KIDS])).toBe(false);
    expect(canChangeBlockTeams(mixed, [KIDS], [KIDS, TUVO])).toBe(false);
    expect(canChangeBlockTeams(mixed, [JUGI, KIDS], [JUGI, KIDS])).toBe(true);
  });

  it("summarises the membership role", () => {
    expect(summaryRole(true, null, [])).toBe("ADMIN");
    expect(summaryRole(false, null, [{ role: "READER" }, { role: "COACH" }])).toBe("COACH");
    expect(summaryRole(false, "COACH", [])).toBe("COACH");
    expect(summaryRole(false, "READER", [])).toBe("READER");
    expect(summaryRole(false, null, [{ role: "READER" }])).toBe("READER");
  });
});

describe("access records", () => {
  it("round-trips admin, all-teams and per-team access", () => {
    const values = [
      { kind: "admin" as const },
      { kind: "all" as const, role: "READER" as const },
      {
        kind: "teams" as const,
        teams: [
          { teamId: KIDS, role: "COACH" as const },
          { teamId: JUGI, role: "READER" as const },
        ],
      },
    ];
    for (const value of values) expect(accessValueOf(accessRecords(value))).toEqual(value);
  });

  it("stores the summary role", () => {
    expect(accessRecords({ kind: "all", role: "COACH" }).role).toBe("COACH");
    expect(accessRecords({ kind: "teams", teams: [{ teamId: JUGI, role: "READER" }] })).toEqual({
      role: "READER",
      allTeamsRole: null,
      teams: [{ teamId: JUGI, role: "READER" }],
    });
  });
});
