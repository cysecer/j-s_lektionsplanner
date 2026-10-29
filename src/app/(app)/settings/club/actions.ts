"use server";

import { revalidatePath } from "next/cache";
import { deleteAssetIfUnused, requireClubAsset } from "@/lib/assets/service";
import { db } from "@/lib/db";
import { action } from "@/lib/server/action";
import { clubLogoSchema, clubSettingsSchema } from "@/lib/settings/schemas";

export const updateClubAction = action({
  role: "ADMIN",
  input: clubSettingsSchema,
  handler: async (input, { viewer }) => {
    await db.club.update({
      where: { id: viewer.clubId },
      data: {
        name: input.name,
        pdfFooterText: input.pdfFooterText,
        defaultStartTimeMinutes: input.defaultStartTime,
        defaultDurationMinutes: input.defaultDurationMinutes,
      },
    });
    revalidatePath("/settings", "layout");
    return null;
  },
});

/** Sets (or removes) the logo; the previous image is deleted once unused. */
export const setClubLogoAction = action({
  role: "ADMIN",
  input: clubLogoSchema,
  handler: async ({ assetId }, { viewer }) => {
    if (assetId) await requireClubAsset(viewer.clubId, assetId);
    const previous = await db.club.findUniqueOrThrow({
      where: { id: viewer.clubId },
      select: { logoAssetId: true },
    });
    await db.club.update({ where: { id: viewer.clubId }, data: { logoAssetId: assetId } });
    if (previous.logoAssetId && previous.logoAssetId !== assetId) {
      await deleteAssetIfUnused(previous.logoAssetId);
    }
    revalidatePath("/settings", "layout");
    return null;
  },
});
