import "server-only";
import { getTranslations } from "next-intl/server";
import { LOCALE_COOKIE } from "@/i18n/config";
import type { Viewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toIsoDate } from "@/lib/format";
import { visibleLessonsWhere } from "@/lib/lessons/visibility";
import { ActionFailure } from "@/lib/server/result";
import { escapeHtml, pdfFileName } from "./filename";
import { issuePrintToken } from "./print-access";
import { releasePdfExport, reservePdfExport } from "./quota";
import { renderPdf } from "./renderer";

/**
 * Renders a lesson of the viewer's club as PDF, in memory only. Counts
 * against the viewer's daily PDF quota; a failed render does not.
 */
export async function renderLessonPdf(
  viewer: Viewer,
  lessonId: string,
  layoutId: string | null,
): Promise<{ pdf: Buffer; fileName: string }> {
  const lesson = await db.lesson.findFirst({
    where: { AND: [visibleLessonsWhere(viewer), { id: lessonId }] },
    select: { id: true, title: true, date: true, team: { select: { name: true } } },
  });
  if (!lesson) throw new ActionFailure("notFound");
  const club = await db.club.findUniqueOrThrow({
    where: { id: viewer.clubId },
    select: { pdfFooterText: true },
  });
  const t = await getTranslations("pdf");

  const exportId = await reservePdfExport(viewer, lesson.id);
  let pdf: Buffer;
  try {
    const token = issuePrintToken({ clubId: viewer.clubId, lessonId: lesson.id, layoutId });
    pdf = await renderPdf({
      path: `/print/lessons/${lesson.id}?token=${encodeURIComponent(token)}`,
      locale: viewer.locale,
      localeCookie: LOCALE_COOKIE,
      footerTemplate: footer(club.pdfFooterText, t("pageOf", { page: "\u0001", pages: "\u0002" })),
    });
  } catch (error) {
    await releasePdfExport(exportId);
    console.error("PDF export failed", error);
    throw new ActionFailure("internal", "pdfFailed");
  }

  return { pdf, fileName: fileNameOf(lesson, t("fileWord")) };
}

type LessonName = { title: string; date: Date; team: { name: string } | null };

function fileNameOf(lesson: LessonName, word: string) {
  return pdfFileName({
    date: toIsoDate(lesson.date),
    word,
    team: lesson.team?.name ?? null,
    title: lesson.title,
  });
}

/** The name the PDF will get, without rendering it (e.g. for the mail preview). */
export async function lessonPdfFileName(lesson: LessonName): Promise<string> {
  const t = await getTranslations("pdf");
  return fileNameOf(lesson, t("fileWord"));
}

/**
 * Chromium's footer template (HTML, so all text is escaped): club footer
 * text on the left, "Seite 1 von 2" on the right of every page.
 */
function footer(text: string | null, pageOf: string) {
  const pages = escapeHtml(pageOf)
    .replace("\u0001", '<span class="pageNumber"></span>')
    .replace("\u0002", '<span class="totalPages"></span>');
  return `<div style="width:100%;margin:0 10mm 0 16mm;display:flex;justify-content:space-between;font-family:Arial,Helvetica,sans-serif;font-size:7.5pt;color:#333"><span>${escapeHtml(text ?? "")}</span><span>${pages}</span></div>`;
}
