import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FieldsEditor } from "./fields-editor";

export default async function FieldsSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations("settings.fields");
  const fields = await db.customField.findMany({
    where: { clubId: viewer.clubId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: {
      id: true,
      label: true,
      type: true,
      searchable: true,
      filterable: true,
      archivedAt: true,
    },
  });
  const rows = fields.map(({ archivedAt, ...f }) => ({ ...f, archived: archivedAt !== null }));
  return (
    <div className="max-w-3xl">
      <SectionCard title={t("title")} description={t("intro")}>
        <FieldsEditor
          active={rows.filter((f) => !f.archived)}
          archived={rows.filter((f) => f.archived)}
        />
      </SectionCard>
    </div>
  );
}
