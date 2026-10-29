import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { smtpPasswordReadable } from "@/lib/mail/config";
import { MailSettingsForm } from "./mail-settings-form";

export default async function MailSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations("settings.mail");
  const [settings, club] = await Promise.all([
    db.mailSettings.findUnique({ where: { clubId: viewer.clubId } }),
    db.club.findUniqueOrThrow({ where: { id: viewer.clubId }, select: { name: true } }),
  ]);

  // The password itself never leaves the server: only whether one is stored.
  const password = !settings?.passwordEncrypted
    ? ("none" as const)
    : smtpPasswordReadable(viewer.clubId, settings.passwordEncrypted)
      ? ("stored" as const)
      : ("lost" as const);

  return (
    <div className="grid max-w-3xl gap-6">
      <SectionCard title={t("title")} description={t("intro")}>
        <MailSettingsForm
          configured={settings !== null}
          fallback={env.SMTP_HOST ?? null}
          allowInsecure={!env.SMTP_REQUIRE_TLS}
          clubName={club.name}
          adminEmail={viewer.email}
          password={password}
          initial={{
            host: settings?.host ?? "",
            port: String(settings?.port ?? 587),
            security: settings?.security ?? "STARTTLS",
            username: settings?.username ?? "",
            fromEmail: settings?.fromEmail ?? "",
            fromName: settings?.fromName ?? "",
          }}
        />
      </SectionCard>
    </div>
  );
}
