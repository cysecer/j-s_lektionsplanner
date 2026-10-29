"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { accessRecords } from "@/lib/auth/team-access";
import { assertActiveTeams, createInvitation } from "@/lib/invitations/create";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";
import { assertFound } from "@/lib/settings/helpers";
import {
  invitationIdSchema,
  invitePersonSchema,
  membershipIdSchema,
  memberUpdateSchema,
} from "@/lib/settings/schemas";

const done = () => {
  revalidatePath("/settings/people");
  return null;
};

/** A coach entry can belong to one account only, and must be active. */
async function assertCoachAvailable(clubId: string, coachId: string, exceptMembershipId?: string) {
  const coach = await db.coach.findFirst({
    where: { id: coachId, clubId, archivedAt: null },
    select: { membership: { select: { id: true } } },
  });
  if (!coach) throw new ActionFailure("validation", "unknownCoach");
  if (coach.membership && coach.membership.id !== exceptMembershipId) {
    throw new ActionFailure("conflict", "coachLinked");
  }
}

/** The club must always keep at least one administrator. */
async function assertKeepsAnAdmin(clubId: string, membershipId: string, newRole: Role | null) {
  if (newRole === "ADMIN") return;
  const target = await db.membership.findFirst({
    where: { id: membershipId, clubId },
    select: { role: true },
  });
  if (target?.role !== "ADMIN") return;
  const admins = await db.membership.count({ where: { clubId, role: "ADMIN" } });
  if (admins <= 1) throw new ActionFailure("conflict", "lastAdmin");
}

export const invitePersonAction = action({
  role: "ADMIN",
  input: invitePersonSchema,
  handler: async (input, { viewer }) => {
    const member = await db.membership.findFirst({
      where: { clubId: viewer.clubId, user: { email: input.email } },
      select: { id: true },
    });
    if (member) throw new ActionFailure("conflict", "alreadyMember");
    if (input.coachId) await assertCoachAvailable(viewer.clubId, input.coachId);
    const { url, emailError } = await createInvitation({
      clubId: viewer.clubId,
      email: input.email,
      access: input.access,
      coachId: input.coachId,
      locale: input.locale,
      invitedById: viewer.userId,
    });
    done();
    return { url, emailError };
  },
});

export const revokeInvitationAction = action({
  role: "ADMIN",
  input: invitationIdSchema,
  handler: async ({ invitationId }, { viewer }) => {
    assertFound(
      await db.invitation.updateMany({
        where: { id: invitationId, clubId: viewer.clubId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
    return done();
  },
});

export const updateMemberAction = action({
  role: "ADMIN",
  input: memberUpdateSchema,
  handler: async ({ membershipId, access, coachId }, { viewer }) => {
    const records = accessRecords(access);
    await assertKeepsAnAdmin(viewer.clubId, membershipId, records.role);
    if (coachId) await assertCoachAvailable(viewer.clubId, coachId, membershipId);
    await db.$transaction(async (tx) => {
      await assertActiveTeams(tx, viewer.clubId, records.teams);
      assertFound(
        await tx.membership.updateMany({
          where: { id: membershipId, clubId: viewer.clubId },
          data: { role: records.role, allTeamsRole: records.allTeamsRole, coachId },
        }),
      );
      // Team roles are replaced as a whole; they take effect on the next request.
      await tx.membershipTeam.deleteMany({ where: { membershipId } });
      await tx.membershipTeam.createMany({
        data: records.teams.map((t) => ({ membershipId, ...t })),
      });
    });
    return done();
  },
});

/**
 * Removes a person from the club and ends their sessions immediately. An
 * account without any club left is deleted completely (incl. passkeys).
 */
export const removeMemberAction = action({
  role: "ADMIN",
  input: membershipIdSchema,
  handler: async ({ membershipId }, { viewer }) => {
    const membership = await db.membership.findFirst({
      where: { id: membershipId, clubId: viewer.clubId },
      select: { userId: true },
    });
    if (!membership) throw new ActionFailure("notFound");
    if (membership.userId === viewer.userId) throw new ActionFailure("conflict", "removeSelf");
    await assertKeepsAnAdmin(viewer.clubId, membershipId, null);

    await db.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: membershipId } });
      await tx.session.deleteMany({ where: { userId: membership.userId } });
      const remaining = await tx.membership.count({ where: { userId: membership.userId } });
      if (remaining === 0) await tx.user.delete({ where: { id: membership.userId } });
    });
    return done();
  },
});
