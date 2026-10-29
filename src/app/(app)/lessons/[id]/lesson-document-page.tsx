import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LessonDocumentView } from "@/components/lesson-document/lesson-document";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { Button } from "@/components/ui/button";
import type { Viewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDocumentClub, getLessonDocument, resolveLayout } from "@/lib/lessons/document-queries";
import { remainingPdfs } from "@/lib/pdf/quota";
import { LayoutSwitcher } from "./layout-switcher";

/**
 * A lesson as document in the chosen layout: what readers see, and the
 * preview for coaches. `layoutId` (from ?layout=) only changes the view.
 */
export async function LessonDocumentPage({
  viewer,
  lessonId,
  layoutId,
}: {
  viewer: Viewer;
  lessonId: string;
  layoutId: string | undefined;
}) {
  const t = await getTranslations();
  const sectionTitle = (s: { builtin: string | null; name: string | null }) =>
    s.name ?? (s.builtin ? t(`sections.${s.builtin as "INTRO"}`) : "");
  const result = await getLessonDocument(viewer.clubId, lessonId, sectionTitle);
  if (!result) notFound();

  const [layout, club, layouts, remaining] = await Promise.all([
    resolveLayout(viewer.clubId, layoutId ?? result.layoutId),
    getDocumentClub(viewer.clubId),
    db.layout.findMany({
      where: { clubId: viewer.clubId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    remainingPdfs(viewer),
  ]);
  const canEdit = viewer.permissions.editLessons;

  return (
    <div data-wide-page className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" className="-ml-3 h-11">
          <Link href={canEdit ? `/lessons/${lessonId}` : "/lessons"}>
            <ArrowLeft aria-hidden />
            {canEdit ? t("lessons.preview.backToEditor") : t("lessons.back")}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          {layouts.length > 1 && layout.id ? (
            <LayoutSwitcher layouts={layouts} current={layout.id} />
          ) : null}
          <PdfDownloadButton lessonId={lessonId} layoutId={layoutId} remaining={remaining} />
        </div>
      </div>
      <h1 className="sr-only">{result.document.title}</h1>
      <div className="overflow-x-auto rounded-lg border bg-white p-4 shadow-sm sm:p-8 print:overflow-visible print:border-0 print:p-0 print:shadow-none">
        <LessonDocumentView
          document={result.document}
          layout={layout.config}
          club={club}
          className="min-w-[40rem] print:min-w-0"
        />
      </div>
    </div>
  );
}
