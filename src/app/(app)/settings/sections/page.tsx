import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { SectionsEditor } from "./sections-editor";

export default async function SectionsSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations("settings.sections");
  const sections = await db.section.findMany({
    where: { clubId: viewer.clubId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, builtin: true, name: true, _count: { select: { lessonItems: true } } },
  });
  return (
    <div className="max-w-3xl">
      <SectionCard title={t("title")} description={t("intro")}>
        <SectionsEditor
          sections={sections.map((s) => ({
            id: s.id,
            builtin: s.builtin,
            name: s.name,
            inUse: s._count.lessonItems > 0,
          }))}
        />
      </SectionCard>
    </div>
  );
}
