"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { blockInputSchema } from "@/lib/blocks/schema";
import { createBlock, deleteBlock, duplicateBlock, updateBlock } from "@/lib/blocks/service";
import { action } from "@/lib/server/action";

export const createBlockAction = action({
  role: "COACH",
  input: blockInputSchema,
  handler: async (input, { viewer }) => {
    const block = await createBlock(viewer.clubId, input);
    revalidatePath("/blocks");
    return block;
  },
});

export const updateBlockAction = action({
  role: "COACH",
  input: z.strictObject({ id: z.uuid(), block: blockInputSchema }),
  handler: async ({ id, block }, { viewer }) => {
    const result = await updateBlock(viewer.clubId, id, block);
    revalidatePath("/blocks");
    return result;
  },
});

export const duplicateBlockAction = action({
  role: "COACH",
  input: z.strictObject({ id: z.uuid() }),
  handler: async ({ id }, { viewer }) => {
    const t = await getTranslations("blocks");
    const block = await duplicateBlock(viewer.clubId, id, t("copySuffix"));
    revalidatePath("/blocks");
    return block;
  },
});

export const deleteBlockAction = action({
  role: "COACH",
  input: z.strictObject({ id: z.uuid() }),
  handler: async ({ id }, { viewer }) => {
    await deleteBlock(viewer.clubId, id);
    revalidatePath("/blocks");
    return null;
  },
});
