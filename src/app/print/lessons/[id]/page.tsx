import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { LessonDocumentView } from "@/components/lesson-document/lesson-document";
import { storage } from "@/lib/assets/service";
import { db } from "@/lib/db";
import { getDocumentClub, getLessonDocument, resolveLayout } from "@/lib/lessons/document-queries";
import type { LessonDocument } from "@/lib/lessons/document";
import { consumePrintToken } from "@/lib/pdf/print-access";
import { parsePageInput } from "@/lib/server/params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Internal page for the PDF renderer only. There is no session: access is
 * a one-time token from the PDF route (signed, one lesson, one minute).
 * Images are inlined because /api/assets needs a session.
 */
export default async function PrintLessonPage({
  params,
  searchParams,
}: PageProps<"/print/lessons/[id]">) {
  const { id } = await parsePageInput(z.object({ id: z.uuid() }), params);
  const { token } = await parsePageInput(
    z.object({ token: z.string().min(1).max(2000) }),
    searchParams,
  );
  const access = consumePrintToken(token, id);
  if (!access) notFound();

  const t = await getTranslations();
  const sectionTitle = (s: { builtin: string | null; name: string | null }) =>
    s.name ?? (s.builtin ? t(`sections.${s.builtin as "INTRO"}`) : "");
  const result = await getLessonDocument(access.clubId, id, sectionTitle);
  if (!result) notFound();
  const [layout, club] = await Promise.all([
    resolveLayout(access.clubId, access.layoutId ?? result.layoutId),
    getDocumentClub(access.clubId),
  ]);
  const inlineAssets = await inlineImages(access.clubId, [
    ...(layout.config.document.showLogo && club.logoAssetId ? [club.logoAssetId] : []),
    ...imageIds(result.document, club.fields),
  ]);

  return (
    <main className="pdf-export bg-white">
      <LessonDocumentView
        document={result.document}
        layout={layout.config}
        club={{ ...club, inlineAssets }}
      />
    </main>
  );
}

function imageIds(doc: LessonDocument, fields: { id: string; type: string }[]) {
  const imageFields = fields.filter((f) => f.type === "IMAGE").map((f) => f.id);
  return doc.sections.flatMap((s) =>
    s.items.flatMap((item) => [
      ...item.sketchAssetIds,
      ...imageFields
        .map((f) => item.customValues[f])
        .filter((v): v is string => typeof v === "string"),
    ]),
  );
}

/** Data URIs for the club's images; unknown or foreign ids are skipped. */
async function inlineImages(clubId: string, ids: string[]) {
  const unique = [...new Set(ids)].filter((id) => z.uuid().safeParse(id).success);
  if (unique.length === 0) return {};
  const assets = await db.asset.findMany({
    where: { clubId, id: { in: unique } },
    select: { id: true, storageKey: true, mimeType: true },
  });
  const entries = await Promise.all(
    assets.map(async (a) => {
      const data = await storage.get(a.storageKey);
      return data
        ? ([a.id, `data:${a.mimeType};base64,${data.toString("base64")}`] as const)
        : null;
    }),
  );
  return Object.fromEntries(entries.filter((e) => e !== null));
}
