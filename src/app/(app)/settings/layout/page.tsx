import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { LayoutsList } from "./layouts-list";

export default async function LayoutSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations("settings.layout");
  const [layouts, club] = await Promise.all([
    db.layout.findMany({
      where: { clubId: viewer.clubId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { lessons: true } } },
    }),
    db.club.findUniqueOrThrow({
      where: { id: viewer.clubId },
      select: { defaultLayoutId: true },
    }),
  ]);
  return (
    <div className="max-w-3xl">
      <SectionCard title={t("title")} description={t("intro")}>
        <LayoutsList
          layouts={layouts.map((l) => ({
            id: l.id,
            name: l.name,
            lessons: l._count.lessons,
            isDefault: l.id === club.defaultLayoutId,
          }))}
        />
      </SectionCard>
    </div>
  );
}
