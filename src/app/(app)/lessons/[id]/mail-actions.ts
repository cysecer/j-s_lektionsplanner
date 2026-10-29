"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { Viewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { lessonMailSchema, renderLessonEmail } from "@/lib/mail/lesson-email";
import { loggedSend } from "@/lib/mail/log";
import { sendMail } from "@/lib/mail/send";
import { lessonPdfFileName, renderLessonPdf } from "@/lib/pdf/lesson-pdf";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";

async function findLesson(viewer: Viewer, lessonId: string) {
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, clubId: viewer.clubId },
    select: { id: true, title: true, date: true, team: { select: { name: true } } },
  });
  if (!lesson) throw new ActionFailure("notFound");
  return lesson;
}

async function mailFooter(viewer: Viewer) {
  const t = await getTranslations("mail.lesson");
  const club = await db.club.findUniqueOrThrow({
    where: { id: viewer.clubId },
    select: { name: true },
  });
  return t("footer", { name: viewer.name, club: club.name, email: viewer.email });
}

/**
 * Everything the send dialog needs: pre-filled texts, the sender, address
 * suggestions (club members and earlier recipients) and the send history.
 */
export const lessonMailDialogAction = action({
  role: "COACH",
  input: z.strictObject({ lessonId: z.uuid() }),
  handler: async ({ lessonId }, { viewer }) => {
    const lesson = await findLesson(viewer, lessonId);
    const t = await getTranslations("mail.lesson");
    const date = formatDate(lesson.date, viewer.locale);
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const [settings, club, members, recent, history, attachmentName, footer] = await Promise.all([
      db.mailSettings.findUnique({
        where: { clubId: viewer.clubId },
        select: { fromEmail: true, fromName: true },
      }),
      db.club.findUniqueOrThrow({ where: { id: viewer.clubId }, select: { name: true } }),
      db.user.findMany({
        where: { memberships: { some: { clubId: viewer.clubId } } },
        select: { name: true, email: true },
        orderBy: { name: "asc" },
        take: 300,
      }),
      db.mailLog.findMany({
        where: {
          clubId: viewer.clubId,
          lessonId: { not: null },
          status: "SENT",
          createdAt: { gte: since },
        },
        select: { recipients: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.mailLog.findMany({
        where: { clubId: viewer.clubId, lessonId },
        select: {
          createdAt: true,
          recipients: true,
          status: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      lessonPdfFileName(lesson),
      mailFooter(viewer),
    ]);

    const known = new Set(members.map((m) => m.email));
    const earlier = [...new Set(recent.flatMap((r) => r.recipients))].filter((e) => !known.has(e));
    const from = settings
      ? `${settings.fromName ?? club.name} <${settings.fromEmail}>`
      : (env.SMTP_HOST && env.MAIL_FROM) || null;

    return {
      from,
      replyTo: viewer.email,
      subject: t("subject", { date, title: lesson.title }),
      message: t("message", { date, title: lesson.title, name: viewer.name }),
      footer,
      attachmentName,
      suggestions: [
        ...members.map((m) => ({ email: m.email, name: m.name })),
        ...earlier.slice(0, 100).map((email) => ({ email, name: null })),
      ],
      history: history.map((h) => ({
        at: h.createdAt.toISOString(),
        by: h.user.name,
        recipients: h.recipients,
        failed: h.status === "FAILED",
      })),
    };
  },
});

/**
 * Sends the lesson as PDF attachment. Replies go to the sender, not to the
 * club's address. Readers cannot send (role COACH).
 */
export const sendLessonMailAction = action({
  role: "COACH",
  input: lessonMailSchema,
  handler: async (input, { viewer }) => {
    await findLesson(viewer, input.lessonId);
    const { pdf, fileName } = await renderLessonPdf(viewer, input.lessonId, input.layoutId);
    const { text, html } = renderLessonEmail({
      message: input.message,
      footer: await mailFooter(viewer),
      attachmentName: fileName,
    });
    await loggedSend(
      viewer,
      { lessonId: input.lessonId, recipients: input.to, subject: input.subject },
      () =>
        sendMail(viewer.clubId, {
          to: input.to,
          replyTo: viewer.email,
          subject: input.subject,
          text,
          html,
          attachments: [{ filename: fileName, content: pdf, contentType: "application/pdf" }],
        }),
    );
    return { count: input.to.length };
  },
});
