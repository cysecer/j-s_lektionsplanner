"use server";

import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getPasswordBlocklist } from "@/lib/auth/blocklist";
import { checkPassword, PASSWORD_MAX_LENGTH, passwordContext } from "@/lib/auth/password-policy";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";
import { resetTokenSchema } from "./token";

export const resetPasswordAction = action({
  role: "public",
  input: z.strictObject({
    token: resetTokenSchema,
    newPassword: z
      .string()
      .min(1)
      .max(PASSWORD_MAX_LENGTH * 4),
  }),
  handler: async ({ token, newPassword }) => {
    const problem = checkPassword(newPassword, {
      blocklist: await getPasswordBlocklist(),
      context: passwordContext({ email: "" }),
    });
    if (problem)
      throw new ActionFailure("validation", problem, { newPassword: [`password.${problem}`] });
    try {
      await auth.api.resetPassword({ body: { token, newPassword } });
    } catch {
      throw new ActionFailure("validation", "invalidToken");
    }
    return null;
  },
});
