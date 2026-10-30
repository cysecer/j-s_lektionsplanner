import "server-only";
import { z } from "zod";
import { localeSchema } from "@/i18n/config";
import { accessRecords } from "@/lib/auth/team-access";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendInvitationEmail } from "@/lib/mail/auth-emails";
import { ActionFailure } from "@/lib/server/result";
import { accessSchema } from "@/lib/settings/schemas";

export const INVITATION_VALID_DAYS = 7;

export const createInvitationSchema = z.strictObject({
  clubId: z.uuid(),
  email: z
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  access: accessSchema,
  coachId: z.uuid().nullable(),
  locale: localeSchema,
  invitedById: z.uuid().nullable(),
});

/**
 * Creates an invitation, revoking any open one for the same address, and
 * emails the link. Returns the link so admins can also share it directly –
 * also when the email could not be sent (e.g. no mail server set up yet):
 * then `emailError` names the reason.
 */
export async function createInvitation(raw: z.input<typeof createInvitationSchema>) {
  const input = createInvitationSchema.parse(raw);
  const access = accessRecords(input.access);
  const token = generateToken();

  const { club, inviter } = await db.$transaction(async (tx) => {
    const club = await tx.club.findUniqueOrThrow({ where: { id: input.clubId } });
    if (input.coachId) {
      await tx.coach.findFirstOrThrow({ where: { id: input.coachId, clubId: input.clubId } });
    }
    await assertActiveTeams(tx, input.clubId, access.teams);
    await tx.invitation.updateMany({
      where: { clubId: input.clubId, email: input.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.invitation.create({
      data: {
        clubId: input.clubId,
        email: input.email,
        role: access.role,
        allTeamsRole: access.allTeamsRole,
        teams: { create: access.teams },
        coachId: input.coachId,
        locale: input.locale,
        invitedById: input.invitedById,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    const inviter = input.invitedById
      ? await tx.user.findUnique({ where: { id: input.invitedById }, select: { name: true } })
      : null;
    return { club, inviter };
  });

  const url = new URL(`/invite/${token}`, env.APP_URL).toString();
  try {
    await sendInvitationEmail({
      clubId: input.clubId,
      to: input.email,
      url,
      locale: input.locale,
      clubName: club.name,
      role: access.role,
      inviterName: inviter?.name ?? null,
      validDays: INVITATION_VALID_DAYS,
    });
  } catch (error) {
    if (!(error instanceof ActionFailure)) throw error;
    return { url, emailError: error.code ?? "mailFailed" };
  }
  return { url, emailError: null };
}

/** Team roles may only name active teams of the club. */
export async function assertActiveTeams(
  tx: Pick<typeof db, "team">,
  clubId: string,
  teams: { teamId: string }[],
) {
  if (teams.length === 0) return;
  const found = await tx.team.count({
    where: { clubId, archivedAt: null, id: { in: teams.map((t) => t.teamId) } },
  });
  if (found !== teams.length) throw new ActionFailure("validation", "unknownTeam");
}

/** Looks up an open invitation by its token (for the accept page). */
export async function findOpenInvitation(token: string) {
  return db.invitation.findFirst({
    where: {
      tokenHash: hashToken(token),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      email: true,
      role: true,
      locale: true,
      club: { select: { name: true } },
      coach: { select: { name: true } },
    },
  });
}
