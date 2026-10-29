import { z } from "zod";
import { attachmentHeader } from "@/lib/pdf/filename";
import { renderLessonPdf } from "@/lib/pdf/lesson-pdf";
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
    const { pdf, fileName } = await renderLessonPdf(viewer, params.id, query.layout ?? null);
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
