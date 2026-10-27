import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <AcceptInvitationForm
      token={token}
      email={invitation.email}
      suggestedName={invitation.coach?.name ?? ""}
      intro={t("auth.invitation.intro", {
        clubName: invitation.club.name,
        role: t(`roles.${invitation.role}`),
      })}
    />
  );
}
