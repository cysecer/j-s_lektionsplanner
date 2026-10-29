import { z } from "zod";
import { escapeHtml } from "./templates";

export const MAX_RECIPIENTS = 20;
export const MAX_MESSAGE_LENGTH = 5000;

const recipient = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "validation.email" }).max(254));

/** Sending a lesson: recipients, subject and a personal message; the PDF is attached. */
export const lessonMailSchema = z.strictObject({
  lessonId: z.uuid(),
  layoutId: z.uuid().nullable(),
  to: z
    .array(recipient)
    .max(100)
    .transform((list) => [...new Set(list)])
    .refine((list) => list.length > 0, { message: "validation.recipientsRequired" })
    .refine((list) => list.length <= MAX_RECIPIENTS, { message: "validation.tooManyRecipients" }),
  subject: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .max(200, { message: "validation.tooLong" })
    // No line breaks: they would let the subject add mail headers.
    .refine((s) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(s), { message: "validation.invalid" }),
  message: z
    .string()
    .max(MAX_MESSAGE_LENGTH * 2)
    .transform((s) => s.replace(/\r\n?/g, "\n").trim())
    .pipe(
      z
        .string()
        .max(MAX_MESSAGE_LENGTH, { message: "validation.tooLong" })
        // Line breaks and tabs are fine in the text; other control characters are not.
        .refine((s) => !/[^\P{Cc}\n\t]/u.test(s), { message: "validation.invalid" }),
    ),
});

export type LessonMailInput = z.output<typeof lessonMailSchema>;

export type LessonEmail = {
  message: string;
  /** "Gesendet von Petra über den Lektionsplaner. Antworten gehen an …" */
  footer: string;
  attachmentName: string;
};

/**
 * The personal message as plain text and HTML (escaped, line breaks kept),
 * then a short note on who sent it. Shared by the preview and the server.
 */
export function renderLessonEmail(email: LessonEmail): { text: string; html: string } {
  const text = [email.message, "", "—", email.footer].join("\n").trim();
  const paragraphs = email.message
    .split(/\n{2,}/)
    .filter((p) => p.trim() !== "")
    .map(
      (p) =>
        `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(p).replaceAll("\n", "<br>")}</p>`,
    )
    .join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
${paragraphs}
<p style="margin:24px 0 0;padding:12px 16px;background:#f5f5f4;border-radius:8px;font-size:14px">📎 ${escapeHtml(email.attachmentName)}</p>
<p style="margin:24px 0 0;font-size:13px;color:#57534e">${escapeHtml(email.footer)}</p>
</div></body></html>`;
  return { text, html };
}
