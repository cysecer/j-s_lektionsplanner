import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { localeSchema } from "@/i18n/config";
import { db } from "@/lib/db";
import { hashToken, tokenSchema } from "./tokens";

/**
 * POST /api/auth/invitation/accept – redeems an invitation token: creates the
 * account (or reuses an existing one with the same email), adds the club
 * membership and signs the user in. The token proves control of the inbox,
 * so the email is marked verified.
 */
export const invitationPlugin = () =>
  ({
    id: "invitation",
    endpoints: {
      acceptInvitation: createAuthEndpoint(
        "/invitation/accept",
        {
          method: "POST",
          body: z.strictObject({
            token: tokenSchema,
            name: z.string().trim().min(1).max(100),
            /** Language shown while accepting; becomes the account's language. */
            locale: localeSchema,
          }),
        },
        async (ctx) => {
          const now = new Date();
          const tokenHash = hashToken(ctx.body.token);

          // Claim atomically so a token can be redeemed only once.
          const claimed = await db.invitation.updateMany({
            where: { tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
            data: { acceptedAt: now },
          });
          if (claimed.count !== 1) {
            throw new APIError("BAD_REQUEST", {
              code: "INVITATION_INVALID",
              message: "Invitation is invalid or expired",
            });
          }
          const invitation = await db.invitation.findUniqueOrThrow({
            where: { tokenHash },
            include: { teams: { select: { teamId: true, role: true } } },
          });

          try {
            const existing = await ctx.context.internalAdapter.findUserByEmail(invitation.email);
            const userRecord =
              existing?.user ??
              (await ctx.context.internalAdapter.createUser(
                {
                  email: invitation.email,
                  name: ctx.body.name,
                  emailVerified: true,
                  locale: ctx.body.locale,
                },
                { method: "invitation" },
              ));

            // Role and team roles exactly as invited (replacing earlier ones).
            const access = {
              role: invitation.role,
              allTeamsRole: invitation.allTeamsRole,
              teams: { create: invitation.teams },
            };
            await db.$transaction(async (tx) => {
              const existingMembership = await tx.membership.findUnique({
                where: { userId_clubId: { userId: userRecord.id, clubId: invitation.clubId } },
                select: { id: true },
              });
              if (existingMembership) {
                await tx.membershipTeam.deleteMany({
                  where: { membershipId: existingMembership.id },
                });
              }
              await tx.membership.upsert({
                where: { userId_clubId: { userId: userRecord.id, clubId: invitation.clubId } },
                create: {
                  userId: userRecord.id,
                  clubId: invitation.clubId,
                  coachId: invitation.coachId,
                  ...access,
                },
                update: { coachId: invitation.coachId ?? undefined, ...access },
              });
            });

            const session = await ctx.context.internalAdapter.createSession(userRecord.id);
            if (!session) throw new Error("session creation failed");
            await setSessionCookie(ctx, { session, user: userRecord });
            return ctx.json({ ok: true });
          } catch (error) {
            // Give the token back so the person can retry.
            await db.invitation.update({ where: { tokenHash }, data: { acceptedAt: null } });
            throw error;
          }
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
