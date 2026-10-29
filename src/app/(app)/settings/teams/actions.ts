"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";
import { assertFound, assertSameIds, nextSortOrder } from "@/lib/settings/helpers";
import { idSchema, reorderSchema, teamSchema, teamUpdateSchema } from "@/lib/settings/schemas";

const done = () => {
  revalidatePath("/", "layout"); // header team switcher lists teams
  return null;
};

export const createTeamAction = action({
  role: "ADMIN",
  input: teamSchema,
  handler: async (input, { viewer }) => {
    const existing = await db.team.findMany({
      where: { clubId: viewer.clubId },
      select: { sortOrder: true },
    });
    await db.team.create({
      data: {
        clubId: viewer.clubId,
        name: input.name,
        defaultStartTimeMinutes: input.defaultStartTime,
        defaultDurationMinutes: input.defaultDurationMinutes,
        sortOrder: nextSortOrder(existing),
      },
    });
    return done();
  },
});

export const updateTeamAction = action({
  role: "ADMIN",
  input: teamUpdateSchema,
  handler: async (input, { viewer }) => {
    assertFound(
      await db.team.updateMany({
        where: { id: input.id, clubId: viewer.clubId },
        data: {
          name: input.name,
          defaultStartTimeMinutes: input.defaultStartTime,
          defaultDurationMinutes: input.defaultDurationMinutes,
        },
      }),
    );
    return done();
  },
});

export const reorderTeamsAction = action({
  role: "ADMIN",
  input: reorderSchema,
  handler: async ({ ids }, { viewer }) => {
    const teams = await db.team.findMany({
      where: { clubId: viewer.clubId, archivedAt: null },
      select: { id: true },
    });
    assertSameIds(
      ids,
      teams.map((t) => t.id),
    );
    await db.$transaction(
      ids.map((id, sortOrder) => db.team.update({ where: { id }, data: { sortOrder } })),
    );
    return done();
  },
});

/**
 * Deletes a team, or archives it when lessons or blocks still refer to it,
 * so old lesson plans keep their team and team-only blocks don't become
 * club-wide by accident.
 */
export const deleteTeamAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    const team = await db.team.findFirst({
      where: { id, clubId: viewer.clubId },
      select: { _count: { select: { lessons: true, programBlocks: true } } },
    });
    if (!team) throw new ActionFailure("notFound");
    const inUse = team._count.lessons + team._count.programBlocks > 0;
    if (inUse) {
      await db.$transaction([
        db.team.update({ where: { id }, data: { archivedAt: new Date() } }),
        db.membership.updateMany({ where: { activeTeamId: id }, data: { activeTeamId: null } }),
      ]);
    } else {
      await db.team.delete({ where: { id } });
    }
    done();
    return { archived: inUse };
  },
});

export const restoreTeamAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    const active = await db.team.findMany({
      where: { clubId: viewer.clubId, archivedAt: null },
      select: { sortOrder: true },
    });
    assertFound(
      await db.team.updateMany({
        where: { id, clubId: viewer.clubId, archivedAt: { not: null } },
        data: { archivedAt: null, sortOrder: nextSortOrder(active) },
      }),
    );
    return done();
  },
});
