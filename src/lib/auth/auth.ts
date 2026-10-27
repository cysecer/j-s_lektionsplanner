import "server-only";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { toLocale } from "@/i18n/translator";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMagicLinkEmail, sendResetPasswordEmail } from "@/lib/mail/auth-emails";
import { hashPassword, verifyPassword } from "./argon2";
import { getPasswordBlocklist } from "./blocklist";
import { invitationPlugin } from "./invitation-plugin";
import { checkPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";

const appUrl = new URL(env.APP_URL);
const idleSeconds = env.SESSION_IDLE_MINUTES * 60;

/** Same response for wrong password, unknown email and locked account (no enumeration). */
function invalidCredentials() {
  return new APIError("UNAUTHORIZED", {
    code: "INVALID_EMAIL_OR_PASSWORD",
    message: "Invalid email or password",
  });
}

function emailFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("email" in body)) return null;
  const email = (body as { email: unknown }).email;
  return typeof email === "string" ? email.trim().toLowerCase() : null;
}

export const auth = betterAuth({
  appName: "Lektionsplaner",
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
  trustedOrigins: [appUrl.origin],
  telemetry: { enabled: false },
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: {
    database: { generateId: "uuid" },
    useSecureCookies: appUrl.protocol === "https:",
    ipAddress: {
      // Single-value X-Forwarded-For is trusted as is; with proxies configured,
      // the chain is walked from the right to the first untrusted hop.
      ipAddressHeaders: ["x-forwarded-for"],
      trustedProxies: env.TRUSTED_PROXIES,
    },
  },

  user: {
    additionalFields: {
      locale: { type: "string", required: false, defaultValue: "de-CH", input: false },
      failedSignInCount: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
        returned: false,
      },
      lockedUntil: { type: "date", required: false, input: false, returned: false },
    },
  },

  session: {
    // Sliding window = idle timeout; the absolute limit is enforced in session.ts.
    expiresIn: idleSeconds,
    updateAge: Math.max(60, Math.floor(idleSeconds / 12)),
  },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    password: { hash: hashPassword, verify: verifyPassword },
    resetPasswordTokenExpiresIn: 30 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const locale = toLocale((user as { locale?: string }).locale);
      await sendResetPasswordEmail(user.email, url, locale, user.name);
    },
  },

  rateLimit: {
    enabled: env.NODE_ENV !== "test",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/magic-link": { window: 60, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
      "/invitation/accept": { window: 60, max: 5 },
      "/passkey/verify-authentication": { window: 60, max: 10 },
    },
  },

  // Account changes go through validated server actions instead.
  disabledPaths: ["/sign-up/email", "/update-user", "/change-email", "/delete-user"],

  databaseHooks: {
    session: {
      create: {
        // Only members of a club may hold a session (access can be revoked).
        before: async (session) => {
          const membership = await db.membership.findFirst({
            where: { userId: session.userId },
            select: { id: true },
          });
          if (!membership) return false;
        },
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/email") {
        const email = emailFromBody(ctx.body);
        if (!email) return;
        const user = await db.user.findUnique({ where: { email }, select: { lockedUntil: true } });
        if (user?.lockedUntil && user.lockedUntil > new Date()) throw invalidCredentials();
      }

      // Safety net for every endpoint that sets a password. Server actions
      // additionally check against the user's name, email and club.
      if (ctx.path === "/reset-password" || ctx.path === "/change-password") {
        const newPassword = (ctx.body as { newPassword?: unknown } | undefined)?.newPassword;
        if (typeof newPassword !== "string") return;
        const problem = checkPassword(newPassword, {
          blocklist: await getPasswordBlocklist(),
          context: ["lektionsplaner"],
        });
        if (problem) {
          throw new APIError("BAD_REQUEST", {
            code: `PASSWORD_${problem.toUpperCase()}`,
            message: problem,
          });
        }
      }
    }),

    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (newSession) {
        // Any successful sign-in (also passkey or magic link) clears the lock.
        await db.user.update({
          where: { id: newSession.user.id },
          data: { failedSignInCount: 0, lockedUntil: null },
        });
        return;
      }

      if (ctx.path === "/sign-in/email" && isAPIError(ctx.context.returned)) {
        const email = emailFromBody(ctx.body);
        if (!email) return;
        const updated = await db.user.updateMany({
          where: { email },
          data: { failedSignInCount: { increment: 1 } },
        });
        if (updated.count === 0) return;
        const user = await db.user.findUnique({
          where: { email },
          select: { failedSignInCount: true },
        });
        if (user && user.failedSignInCount >= env.AUTH_MAX_FAILED_SIGNINS) {
          await db.user.update({
            where: { email },
            data: {
              failedSignInCount: 0,
              lockedUntil: new Date(Date.now() + env.AUTH_LOCKOUT_MINUTES * 60_000),
            },
          });
        }
      }
    }),
  },

  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      disableSignUp: true,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        // Unknown addresses get no email; the response is identical either way.
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { name: true, locale: true, memberships: { select: { id: true }, take: 1 } },
        });
        if (!user || user.memberships.length === 0) return;
        await sendMagicLinkEmail(email, url, toLocale(user.locale), user.name);
      },
    }),
    passkey({
      rpID: appUrl.hostname,
      rpName: "Lektionsplaner",
      origin: appUrl.origin,
      // User verification (Face ID, fingerprint, PIN) makes a passkey a
      // phishing-resistant multi-factor authenticator.
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    }),
    invitationPlugin(),
    nextCookies(), // must stay last
  ],
});

export type Auth = typeof auth;
