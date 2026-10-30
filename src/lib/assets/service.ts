import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ImageError, processImage } from "@/lib/images/process";
import { ActionFailure } from "@/lib/server/result";
import { LocalStorage } from "@/lib/storage/storage";

export const storage = new LocalStorage(env.STORAGE_DIR);

export const uploadPurposeSchema = z.enum(["logo", "favicon", "sketch", "field"]);
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

const MAX_DIMENSION: Record<UploadPurpose, number> = {
  logo: 1024,
  favicon: 512,
  sketch: 2000,
  field: 2000,
};

/** Validates, normalises and stores an uploaded image for a club. */
export async function storeImage(clubId: string, input: Buffer, purpose: UploadPurpose) {
  let image;
  try {
    image = await processImage(input, { maxDimension: MAX_DIMENSION[purpose] });
  } catch (error) {
    if (error instanceof ImageError) {
      const key = `validation.image${error.code[0]!.toUpperCase()}${error.code.slice(1)}`;
      throw new ActionFailure("validation", error.code, { file: [key] });
    }
    throw error;
  }

  const id = randomUUID();
  const storageKey = `${clubId}/${id}.${image.extension}`;
  await storage.put(storageKey, image.data);
  try {
    return await db.asset.create({
      data: {
        id,
        clubId,
        storageKey,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        byteSize: image.data.length,
      },
      select: { id: true, width: true, height: true },
    });
  } catch (error) {
    await storage.delete(storageKey);
    throw error;
  }
}

/** Ensures an asset id belongs to the club (for actions that attach assets). */
export async function requireClubAsset(clubId: string, assetId: string) {
  const asset = await db.asset.findFirst({ where: { id: assetId, clubId }, select: { id: true } });
  if (!asset) throw new ActionFailure("notFound", "asset");
  return asset;
}

/** Ensures every asset id belongs to the club. */
export async function requireClubAssets(clubId: string, assetIds: string[]) {
  if (assetIds.length === 0) return;
  const found = await db.asset.count({ where: { id: { in: assetIds }, clubId } });
  if (found !== new Set(assetIds).size) throw new ActionFailure("notFound", "asset");
}

/**
 * Removes an asset once nothing refers to it any more: logo, sketches, or
 * an image custom field (stored as a value in the customValues JSON maps).
 */
export async function deleteAssetIfUnused(assetId: string) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      storageKey: true,
      logoOfClub: { select: { id: true } },
      faviconOfClub: { select: { id: true } },
      _count: { select: { blockSketches: true, lessonItemSketches: true } },
    },
  });
  if (
    !asset ||
    asset.logoOfClub ||
    asset.faviconOfClub ||
    asset._count.blockSketches ||
    asset._count.lessonItemSketches
  ) {
    return;
  }
  const [inFields] = await db.$queryRaw<{ used: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "ProgramBlock" b, jsonb_each_text(b."customValues") v WHERE v.value = ${assetId}
      UNION ALL
      SELECT 1 FROM "LessonItem" i, jsonb_each_text(i."customValues") v WHERE v.value = ${assetId}
    ) AS used`;
  if (inFields?.used) return;
  await db.asset.delete({ where: { id: assetId } });
  await storage.delete(asset.storageKey);
}

/** Uploads not attached to anything after this long are abandoned forms. */
export const UNUSED_UPLOAD_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes images that were uploaded but never attached (a form closed
 * without saving), once they are older than a day. Runs with each upload,
 * so storage stays clean without a scheduled job.
 */
export async function sweepUnusedUploads(clubId: string): Promise<number> {
  const candidates = await db.asset.findMany({
    where: {
      clubId,
      createdAt: { lt: new Date(Date.now() - UNUSED_UPLOAD_GRACE_MS) },
      logoOfClub: { is: null },
      faviconOfClub: { is: null },
      blockSketches: { none: {} },
      lessonItemSketches: { none: {} },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  // deleteAssetIfUnused also checks custom image fields before deleting.
  for (const { id } of candidates) await deleteAssetIfUnused(id);
  return candidates.length;
}
