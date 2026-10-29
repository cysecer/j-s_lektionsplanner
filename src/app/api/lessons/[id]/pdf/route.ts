import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n/config";
import { db } from "@/lib/db";
import { toIsoDate } from "@/lib/format";
import { attachmentHeader, escapeHtml, pdfFileName } from "@/lib/pdf/filename";
import { issuePrintToken } from "@/lib/pdf/print-access";
import { releasePdfExport, reservePdfExport } from "@/lib/pdf/quota";
import { renderPdf } from "@/lib/pdf/renderer";
import { ActionFailure } from "@/lib/server/result";
import { route } from "@/lib/server/route";

/**
 * GET /api/lessons/:id/pdf[?layout=…] – the lesson as PDF, streamed to the
 * browser and never stored. Readers have a daily quota (club setting).
 */
export const GET = route({
  role: "READER",
  params: z.strictObject({ id: z.uuid() }),
  query: z.strictObject({ layout: z.uuid().optional() }),
  handler: async ({ viewer, params, query }) => {
    const lesson = await db.lesson.findFirst({
      where: { id: params.id, clubId: viewer.clubId },
      select: { id: true, title: true, date: true, team: { select: { name: true } } },
    });
    if (!lesson) throw new ActionFailure("notFound");
    const club = await db.club.findUniqueOrThrow({
      where: { id: viewer.clubId },
      select: { pdfFooterText: true },
    });

    const exportId = await reservePdfExport(viewer, lesson.id);
    let pdf: Buffer;
    try {
      const t = await getTranslations("pdf");
      const token = issuePrintToken({
        clubId: viewer.clubId,
        lessonId: lesson.id,
        layoutId: query.layout ?? null,
      });
      pdf = await renderPdf({
        path: `/print/lessons/${lesson.id}?token=${encodeURIComponent(token)}`,
        locale: viewer.locale,
        localeCookie: LOCALE_COOKIE,
        footerTemplate: footer(
          club.pdfFooterText,
          t("pageOf", { page: "\u0001", pages: "\u0002" }),
        ),
      });
    } catch (error) {
      await releasePdfExport(exportId);
      console.error("PDF export failed", error);
      throw new ActionFailure("internal", "pdfFailed");
    }

    const t = await getTranslations("pdf");
    const fileName = pdfFileName({
      date: toIsoDate(lesson.date),
      word: t("fileWord"),
      team: lesson.team?.name ?? null,
      title: lesson.title,
    });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(pdf.length),
        "content-disposition": attachmentHeader(fileName),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
});

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
