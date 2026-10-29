"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sealSmtpPassword } from "@/lib/mail/config";
import { loggedSend } from "@/lib/mail/log";
import { sendMail } from "@/lib/mail/send";
import { mailSettingsSchema, needsPasswordAgain } from "@/lib/mail/settings-schema";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";

/**
 * Saves the club's mail server. The password is write-only: it is
 * encrypted here and no page or action ever returns it.
 */
export const saveMailSettingsAction = action({
  role: "ADMIN",
  input: mailSettingsSchema(!env.SMTP_REQUIRE_TLS),
  handler: async (input, { viewer }) => {
    const stored = await db.mailSettings.findUnique({ where: { clubId: viewer.clubId } });
    const hasPassword = stored?.passwordEncrypted != null;
    if (needsPasswordAgain(stored && { ...stored, hasPassword }, input)) {
      throw new ActionFailure("validation", "mailPasswordAgain", {
        password: ["validation.smtpPasswordAgain"],
      });
    }
    const passwordEncrypted =
      input.username === null || input.clearPassword
        ? null
        : input.password !== ""
          ? sealSmtpPassword(viewer.clubId, input.password)
          : (stored?.passwordEncrypted ?? null);
    const data = {
      host: input.host,
      port: input.port,
      security: input.security,
      username: input.username,
      passwordEncrypted,
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      updatedById: viewer.userId,
    };
    await db.mailSettings.upsert({
      where: { clubId: viewer.clubId },
      create: { clubId: viewer.clubId, ...data },
      update: data,
    });
    revalidatePath("/settings/mail");
    return null;
  },
});

/** Back to the server's fallback (SMTP_* environment); forgets the password. */
export const deleteMailSettingsAction = action({
  role: "ADMIN",
  input: z.strictObject({}),
  handler: async (_input, { viewer }) => {
    await db.mailSettings.deleteMany({ where: { clubId: viewer.clubId } });
    revalidatePath("/settings/mail");
    return null;
  },
});

/** Sends a short test email to the admin with the saved settings. */
export const sendTestMailAction = action({
  role: "ADMIN",
  input: z.strictObject({}),
  handler: async (_input, { viewer }) => {
    const t = await getTranslations("settings.mail.test");
    const subject = t("subject");
    await loggedSend(viewer, { lessonId: null, recipients: [viewer.email], subject }, () =>
      sendMail(viewer.clubId, {
        to: [viewer.email],
        subject,
        text: t("body", { name: viewer.name }),
      }),
    );
    return { to: viewer.email };
  },
});
