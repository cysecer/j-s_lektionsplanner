"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getPasswordBlocklist } from "@/lib/auth/blocklist";
import { checkPassword, passwordContext, PASSWORD_MAX_LENGTH } from "@/lib/auth/password-policy";
import { db } from "@/lib/db";
import { ActionFailure } from "@/lib/server/result";
import { action } from "@/lib/server/action";

const passwordField = z
  .string()
  .min(1)
  .max(PASSWORD_MAX_LENGTH * 4);

async function assertStrongPassword(
  password: string,
  viewer: { email: string; name: string; clubId: string },
) {
  const club = await db.club.findUnique({ where: { id: viewer.clubId }, select: { name: true } });
  const problem = checkPassword(password, {
    blocklist: await getPasswordBlocklist(),
    context: passwordContext({ email: viewer.email, name: viewer.name, clubName: club?.name }),
  });
  if (problem)
    throw new ActionFailure("validation", problem, { newPassword: [`password.${problem}`] });
}

/** First password for an account that so far used only magic link / passkey. */
export const setPasswordAction = action({
  role: "READER",
  input: z.strictObject({ newPassword: passwordField }),
  handler: async ({ newPassword }, { viewer }) => {
    await assertStrongPassword(newPassword, viewer);
    await auth.api.setPassword({ body: { newPassword }, headers: await headers() });
    return null;
  },
});

export const changePasswordAction = action({
  role: "READER",
  input: z.strictObject({ currentPassword: passwordField, newPassword: passwordField }),
  handler: async ({ currentPassword, newPassword }, { viewer }) => {
    await assertStrongPassword(newPassword, viewer);
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch {
      throw new ActionFailure("validation", "wrongCurrent", {
        currentPassword: ["password.wrongCurrent"],
      });
    }
    return null;
  },
});

/** Ends every session of this user, including the current one. */
export const signOutEverywhereAction = action({
  role: "READER",
  input: z.strictObject({}),
  handler: async (_input, { viewer }) => {
    await db.session.deleteMany({ where: { userId: viewer.userId } });
    return null;
  },
});
