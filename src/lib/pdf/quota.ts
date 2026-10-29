import "server-only";
import { hasRole } from "@/lib/auth/roles";
import type { Viewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ActionFailure } from "@/lib/server/result";
import { startOfZurichDay } from "./day";

/** Coaches and admins have no quota, only this guard against runaway use. */
export const EDITOR_DAILY_PDF_LIMIT = 200;
const KEEP_DAYS = 90;

async function limitFor(viewer: Viewer): Promise<number> {
  if (hasRole(viewer.role, "COACH")) return EDITOR_DAILY_PDF_LIMIT;
  const club = await db.club.findUniqueOrThrow({
    where: { id: viewer.clubId },
    select: { readerPdfDailyLimit: true },
  });
  return club.readerPdfDailyLimit;
}

/** PDFs the viewer may still create today; null for coaches and admins. */
export async function remainingPdfs(viewer: Viewer): Promise<number | null> {
  if (hasRole(viewer.role, "COACH")) return null;
  const used = await db.pdfExport.count({
    where: { userId: viewer.userId, createdAt: { gte: startOfZurichDay(new Date()) } },
  });
  return Math.max(0, (await limitFor(viewer)) - used);
}

/**
 * Counts one PDF against today's quota before rendering, so parallel
 * requests cannot overshoot (a per-user lock serialises the check).
 * Returns the row id; call `releasePdfExport` if rendering fails.
 */
export async function reservePdfExport(viewer: Viewer, lessonId: string): Promise<string> {
  const limit = await limitFor(viewer);
  const since = startOfZurichDay(new Date());
  const id = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pdf:${viewer.userId}`}))`;
    const used = await tx.pdfExport.count({
      where: { userId: viewer.userId, createdAt: { gte: since } },
    });
    if (used >= limit) return null;
    const row = await tx.pdfExport.create({
      data: { clubId: viewer.clubId, userId: viewer.userId, lessonId },
      select: { id: true },
    });
    return row.id;
  });
  if (!id) throw new ActionFailure("rateLimited", "pdfQuota");

  // Housekeeping: the log is only needed for the quota and a short history.
  await db.pdfExport.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } },
  });
  return id;
}

/** A failed render does not count. */
export async function releasePdfExport(id: string) {
  await db.pdfExport.deleteMany({ where: { id } });
}
