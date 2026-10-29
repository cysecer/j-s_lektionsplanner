import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { TagsEditor } from "./tags-editor";

export default async function TagsSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations("settings.tags");
  const tags = await db.tag.findMany({
    where: { clubId: viewer.clubId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { programBlocks: true } } },
  });
  return (
    <div className="max-w-3xl">
      <SectionCard title={t("title")} description={t("intro")}>
        <TagsEditor
          tags={tags.map((x) => ({ id: x.id, name: x.name, usage: x._count.programBlocks }))}
        />
      </SectionCard>
    </div>
  );
}
