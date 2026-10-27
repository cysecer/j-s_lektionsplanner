import "server-only";
import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { localeSchema } from "@/i18n/config";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendInvitationEmail } from "@/lib/mail/auth-emails";

export const INVITATION_VALID_DAYS = 7;

export const createInvitationSchema = z.strictObject({
  clubId: z.uuid(),
  email: z
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  role: z.enum(Role),
  coachId: z.uuid().nullable(),
  locale: localeSchema,
  invitedById: z.uuid().nullable(),
});

/**
 * Creates an invitation, revoking any open one for the same address, and
 * emails the link. Returns the link so admins can also share it directly.
 */
export async function createInvitation(raw: z.input<typeof createInvitationSchema>) {
  const input = createInvitationSchema.parse(raw);
  const token = generateToken();

  const { club, inviter } = await db.$transaction(async (tx) => {
    const club = await tx.club.findUniqueOrThrow({ where: { id: input.clubId } });
    if (input.coachId) {
      await tx.coach.findFirstOrThrow({ where: { id: input.coachId, clubId: input.clubId } });
    }
    await tx.invitation.updateMany({
      where: { clubId: input.clubId, email: input.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.invitation.create({
      data: {
        clubId: input.clubId,
        email: input.email,
        role: input.role,
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
  await sendInvitationEmail({
    to: input.email,
    url,
    locale: input.locale,
    clubName: club.name,
    role: input.role,
    inviterName: inviter?.name ?? null,
    validDays: INVITATION_VALID_DAYS,
  });
  return { url };
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
      club: { select: { name: true } },
      coach: { select: { name: true } },
    },
  });
}
