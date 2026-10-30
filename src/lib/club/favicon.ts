import "server-only";
import { cache } from "react";
import sharp from "sharp";
import { storage } from "@/lib/assets/service";
import { db } from "@/lib/db";

/** Icon sizes served: browser tab and the Apple home screen. */
export const FAVICON_SIZES = [32, 180] as const;
export type FaviconSize = (typeof FAVICON_SIZES)[number];

/**
 * The installation's favicon. It is shown before anyone signs in, so it
 * cannot depend on a session: with one club per installation it is that
 * club's icon (the oldest club that set one).
 */
export const clubFaviconId = cache(async (): Promise<string | null> => {
  const club = await db.club.findFirst({
    where: { faviconAssetId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { faviconAssetId: true },
  });
  return club?.faviconAssetId ?? null;
});

/** The favicon as a square PNG of the given size (transparent padding). */
export async function renderFavicon(size: FaviconSize): Promise<Buffer | null> {
  const id = await clubFaviconId();
  if (!id) return null;
  const asset = await db.asset.findUnique({ where: { id }, select: { storageKey: true } });
  const data = asset ? await storage.get(asset.storageKey) : null;
  if (!data) return null;
  return sharp(data)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
