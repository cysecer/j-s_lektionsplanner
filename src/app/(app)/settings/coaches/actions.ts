"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";
import { assertFound } from "@/lib/settings/helpers";
import { coachSchema, coachUpdateSchema, idSchema } from "@/lib/settings/schemas";

/** Team ids must belong to the club and be active. */
async function validTeamIds(clubId: string, teamIds: string[]) {
  if (teamIds.length === 0) return [];
  const teams = await db.team.findMany({
    where: { id: { in: teamIds }, clubId, archivedAt: null },
    select: { id: true },
  });
  if (teams.length !== teamIds.length) throw new ActionFailure("validation", "unknownTeam");
  return teamIds;
}

const done = () => {
  revalidatePath("/settings/coaches");
  return null;
};

export const createCoachAction = action({
  role: "ADMIN",
  input: coachSchema,
  handler: async ({ name, teamIds }, { viewer }) => {
    const teams = await validTeamIds(viewer.clubId, teamIds);
    await db.coach.create({
      data: {
        clubId: viewer.clubId,
        name,
        teams: { create: teams.map((teamId) => ({ teamId })) },
      },
    });
    return done();
  },
});

export const updateCoachAction = action({
  role: "ADMIN",
  input: coachUpdateSchema,
  handler: async ({ id, name, teamIds }, { viewer }) => {
    const teams = await validTeamIds(viewer.clubId, teamIds);
    await db.$transaction(async (tx) => {
      assertFound(
        await tx.coach.updateMany({ where: { id, clubId: viewer.clubId }, data: { name } }),
      );
      // Keep links to archived teams; replace the active ones.
      await tx.coachTeam.deleteMany({ where: { coachId: id, team: { archivedAt: null } } });
      await tx.coachTeam.createMany({ data: teams.map((teamId) => ({ coachId: id, teamId })) });
    });
    return done();
  },
});

/** Archives coaches that appear in lessons, blocks or accounts; deletes the rest. */
export const deleteCoachAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    const coach = await db.coach.findFirst({
      where: { id, clubId: viewer.clubId },
      select: {
        membership: { select: { id: true } },
        _count: {
          select: {
            responsibleForBlocks: true,
            responsibleForItems: true,
            presentInLessons: true,
            invitations: true,
          },
        },
      },
    });
    if (!coach) throw new ActionFailure("notFound");
    const c = coach._count;
    const inUse =
      Boolean(coach.membership) ||
      c.responsibleForBlocks + c.responsibleForItems + c.presentInLessons + c.invitations > 0;
    if (inUse) await db.coach.update({ where: { id }, data: { archivedAt: new Date() } });
    else await db.coach.delete({ where: { id } });
    done();
    return { archived: inUse };
  },
});

export const restoreCoachAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    assertFound(
      await db.coach.updateMany({
        where: { id, clubId: viewer.clubId, archivedAt: { not: null } },
        data: { archivedAt: null },
      }),
    );
    return done();
  },
});
