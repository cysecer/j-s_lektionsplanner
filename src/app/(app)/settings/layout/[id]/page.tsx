import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { availableFields, withoutUnknownFields } from "@/lib/layout/editor-model";
import { parseLayoutConfig } from "@/lib/layout/schema";
import {
  getDocumentClub,
  getEmptyDocumentSections,
  getPreviewDocument,
} from "@/lib/lessons/document-queries";
import { parsePageInput } from "@/lib/server/params";
import { LayoutEditor } from "./layout-editor";

export default async function LayoutEditorPage({ params }: PageProps<"/settings/layout/[id]">) {
  const viewer = await requireViewer("ADMIN");
  const { id } = await parsePageInput(z.object({ id: z.uuid() }), params);
  const t = await getTranslations();
  const layout = await db.layout.findFirst({
    where: { id, clubId: viewer.clubId },
    select: { id: true, name: true, config: true },
  });
  if (!layout) notFound();

  const sectionTitle = (s: { builtin: string | null; name: string | null }) =>
    s.name ?? (s.builtin ? t(`sections.${s.builtin as "INTRO"}`) : "");
  const [club, preview, fields] = await Promise.all([
    getDocumentClub(viewer.clubId),
    getPreviewDocument(viewer.clubId, sectionTitle),
    db.customField.findMany({
      where: { clubId: viewer.clubId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
  ]);
  const document = preview ?? {
    title: t("settings.layout.previewTitle"),
    authorName: viewer.name,
    date: new Date().toISOString().slice(0, 10),
    teamName: null,
    startTimeMinutes: null,
    totalDurationMinutes: null,
    location: null,
    ageMin: null,
    ageMax: null,
    groupSize: null,
    difficulty: null,
    safety: null,
    goals: null,
    notes: null,
    presentCoaches: [],
    sections: await getEmptyDocumentSections(viewer.clubId, sectionTitle),
  };

  return (
    <LayoutEditor
      layoutId={layout.id}
      initialName={layout.name}
      initialConfig={withoutUnknownFields(
        parseLayoutConfig(layout.config),
        availableFields(fields.map((f) => f.id)),
      )}
      customFields={fields}
      preview={document}
      previewIsSample={preview === null}
      club={club}
    />
  );
}
