import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LOCALE_COOKIE, localeSchema } from "@/i18n/config";
import { loadMessages } from "@/i18n/messages";
import { toLocale } from "@/i18n/translator";
import { getViewer } from "@/lib/auth/session";
import { tokenSchema } from "@/lib/auth/tokens";
import { findOpenInvitation } from "@/lib/invitations/create";
import { parsePageInput } from "@/lib/server/params";
import { AcceptInvitationForm } from "./accept-form";

export default async function InvitationPage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await parsePageInput(z.object({ token: tokenSchema }), params);
  const t = await getTranslations();
  const invitation = await findOpenInvitation(token);

  if (!invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>{t("auth.invitation.title")}</h1>
          </CardTitle>
          <CardDescription className="text-base">{t("auth.invitation.invalid")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Shown in the language chosen in the invitation – it becomes the
  // account's language. Someone who picked a language with the switcher
  // (cookie) or is signed in keeps theirs.
  const chosen = localeSchema.safeParse((await cookies()).get(LOCALE_COOKIE)?.value).success;
  const locale = chosen || (await getViewer()) ? await getLocale() : toLocale(invitation.locale);
  const tl = await getTranslations({ locale });

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="Europe/Zurich"
    >
      <div lang={locale}>
        <AcceptInvitationForm
          token={token}
          email={invitation.email}
          suggestedName={invitation.coach?.name ?? ""}
          intro={tl("auth.invitation.intro", {
            clubName: invitation.club.name,
            role: tl(`roles.${invitation.role}`),
          })}
        />
      </div>
    </NextIntlClientProvider>
  );
}
