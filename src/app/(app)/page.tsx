import { getTranslations } from "next-intl/server";
import { PasskeyNudge } from "@/components/auth/passkey-nudge";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function HomePage() {
  const viewer = await requireViewer();
  const t = await getTranslations();
  const passkeyCount = await db.passkey.count({ where: { userId: viewer.userId } });

  return (
    <div className="grid gap-6">
      {passkeyCount === 0 ? <PasskeyNudge /> : null}
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("home.title")}</h1>
        <p className="text-muted-foreground">
          {t("home.signedInAs", { name: viewer.name, role: t(`roles.${viewer.role}`) })}
        </p>
        <p className="text-muted-foreground">{t("home.comingSoon")}</p>
      </div>
    </div>
  );
}
