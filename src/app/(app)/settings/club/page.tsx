import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatTimeOfDay } from "@/lib/format";
import { ClubForm } from "./club-form";
import { LogoEditor } from "./logo-editor";

export default async function ClubSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations("settings.club");
  const club = await db.club.findUniqueOrThrow({
    where: { id: viewer.clubId },
    select: {
      name: true,
      pdfFooterText: true,
      logoAssetId: true,
      defaultStartTimeMinutes: true,
      defaultDurationMinutes: true,
    },
  });

  return (
    <div className="grid max-w-3xl gap-6">
      <SectionCard title={t("title")} description={t("intro")}>
        <ClubForm
          initial={{
            name: club.name,
            pdfFooterText: club.pdfFooterText ?? "",
            defaultStartTime: formatTimeOfDay(club.defaultStartTimeMinutes),
            defaultDurationMinutes: String(club.defaultDurationMinutes),
          }}
        />
      </SectionCard>
      <SectionCard title={t("logo")} description={t("logoHint")}>
        <LogoEditor logoAssetId={club.logoAssetId} clubName={club.name} />
      </SectionCard>
    </div>
  );
}
