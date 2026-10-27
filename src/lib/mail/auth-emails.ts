import "server-only";
import type { Role } from "@/generated/prisma/client";
import type { Locale } from "@/i18n/config";
import { getTranslator } from "@/i18n/translator";
import { sendMail } from "./send";
import { renderActionEmail } from "./templates";

async function sendActionEmail(input: {
  to: string;
  locale: Locale;
  name: string | null;
  subject: string;
  body: string;
  buttonLabel: string;
  url: string;
}) {
  const t = await getTranslator(input.locale);
  const { text, html } = renderActionEmail({
    greeting: input.name ? t("email.greeting", { name: input.name }) : t("email.greetingAnonymous"),
    body: input.body,
    buttonLabel: input.buttonLabel,
    url: input.url,
    footer: t("email.ignore"),
    signature: t("email.signature"),
  });
  await sendMail({ to: [input.to], subject: input.subject, text, html });
}

export async function sendMagicLinkEmail(to: string, url: string, locale: Locale, name: string) {
  const t = await getTranslator(locale);
  await sendActionEmail({
    to,
    locale,
    name,
    url,
    subject: t("email.magicLink.subject"),
    body: t("email.magicLink.body"),
    buttonLabel: t("email.magicLink.button"),
  });
}

export async function sendResetPasswordEmail(
  to: string,
  url: string,
  locale: Locale,
  name: string,
) {
  const t = await getTranslator(locale);
  await sendActionEmail({
    to,
    locale,
    name,
    url,
    subject: t("email.resetPassword.subject"),
    body: t("email.resetPassword.body"),
    buttonLabel: t("email.resetPassword.button"),
  });
}

export async function sendInvitationEmail(input: {
  to: string;
  url: string;
  locale: Locale;
  clubName: string;
  role: Role;
  inviterName: string | null;
  validDays: number;
}) {
  const t = await getTranslator(input.locale);
  const role = t(`roles.${input.role}`);
  await sendActionEmail({
    to: input.to,
    locale: input.locale,
    name: null,
    url: input.url,
    subject: t("email.invitation.subject", { clubName: input.clubName }),
    body: input.inviterName
      ? t("email.invitation.body", {
          inviter: input.inviterName,
          role,
          clubName: input.clubName,
          days: input.validDays,
        })
      : t("email.invitation.bodyNoInviter", {
          role,
          clubName: input.clubName,
          days: input.validDays,
        }),
    buttonLabel: t("email.invitation.button"),
  });
}
