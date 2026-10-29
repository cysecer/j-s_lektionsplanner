import "server-only";
import type { Viewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { startOfZurichDay } from "@/lib/pdf/day";
import { ActionFailure } from "@/lib/server/result";

/** Emails one person may send per day – plenty for a club, a brake on misuse. */
export const DAILY_MAIL_LIMIT = 30;
const KEEP_DAYS = 180;

/**
 * Logs a send before it happens, so parallel requests cannot exceed the
 * daily limit (a per-user lock serialises the check). Failed sends still
 * count: retrying in a loop is exactly what the limit is meant to stop.
 */
export async function reserveMail(
  viewer: Viewer,
  entry: { lessonId: string | null; recipients: string[]; subject: string },
): Promise<string> {
  const since = startOfZurichDay(new Date());
  const id = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mail:${viewer.userId}`}))`;
    const used = await tx.mailLog.count({
      where: { userId: viewer.userId, createdAt: { gte: since } },
    });
    if (used >= DAILY_MAIL_LIMIT) return null;
    const row = await tx.mailLog.create({
      data: { clubId: viewer.clubId, userId: viewer.userId, status: "SENT", ...entry },
      select: { id: true },
    });
    return row.id;
  });
  if (!id) throw new ActionFailure("rateLimited", "mailQuota");

  await db.mailLog.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } },
  });
  return id;
}

export async function markMailFailed(id: string) {
  await db.mailLog.updateMany({ where: { id }, data: { status: "FAILED" } });
}

/** Runs `send` with a log entry that turns FAILED when it throws. */
export async function loggedSend(
  viewer: Viewer,
  entry: { lessonId: string | null; recipients: string[]; subject: string },
  send: () => Promise<void>,
) {
  const id = await reserveMail(viewer, entry);
  try {
    await send();
  } catch (error) {
    await markMailFailed(id);
    throw error;
  }
}
