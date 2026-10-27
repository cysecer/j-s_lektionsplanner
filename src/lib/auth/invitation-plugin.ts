import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
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
          const invitation = await db.invitation.findUniqueOrThrow({ where: { tokenHash } });

          try {
            const existing = await ctx.context.internalAdapter.findUserByEmail(invitation.email);
            const userRecord =
              existing?.user ??
              (await ctx.context.internalAdapter.createUser(
                {
                  email: invitation.email,
                  name: ctx.body.name,
                  emailVerified: true,
                  locale: invitation.locale,
                },
                { method: "invitation" },
              ));

            await db.membership.upsert({
              where: { userId_clubId: { userId: userRecord.id, clubId: invitation.clubId } },
              create: {
                userId: userRecord.id,
                clubId: invitation.clubId,
                role: invitation.role,
                coachId: invitation.coachId,
              },
              update: { role: invitation.role, coachId: invitation.coachId ?? undefined },
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
