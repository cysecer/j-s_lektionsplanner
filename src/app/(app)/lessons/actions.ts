"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Difficulty } from "@/generated/prisma/enums";
import { searchBlocks } from "@/lib/blocks/queries";
import { lessonDraftSchema, lessonItemSchema, lessonSaveSchema } from "@/lib/lessons/schema";
import {
  createBlockFromItem,
  createLessonFromDraft,
  deleteLesson,
  duplicateLesson,
  overwriteBlockFromItem,
  saveLesson,
  snapshotFromBlock,
} from "@/lib/lessons/service";
import { action } from "@/lib/server/action";

const idInput = z.strictObject({ id: z.uuid() });

/** "Entwurf speichern": stores a new lesson for the first time. */
export const createLessonAction = action({
  role: "COACH",
  input: lessonDraftSchema,
  handler: async (input, { viewer }) => {
    const lesson = await createLessonFromDraft(viewer, input);
    revalidatePath("/lessons");
    return lesson;
  },
});

export const saveLessonAction = action({
  role: "COACH",
  input: lessonSaveSchema,
  handler: async (input, { viewer }) => {
    const result = await saveLesson(viewer, input);
    revalidatePath("/lessons");
    return result;
  },
});

export const duplicateLessonAction = action({
  role: "COACH",
  input: idInput,
  handler: async ({ id }, { viewer }) => {
    const copy = await duplicateLesson(viewer, id);
    revalidatePath("/lessons");
    return copy;
  },
});

export const deleteLessonAction = action({
  role: "COACH",
  input: idInput,
  handler: async ({ id }, { viewer }) => {
    await deleteLesson(viewer, id);
    revalidatePath("/lessons");
    return null;
  },
});

/** Admins delete several lessons at once from the overview. */
export const deleteLessonsAction = action({
  role: "ADMIN",
  input: z.strictObject({
    ids: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, { message: "validation.invalid" }),
  }),
  handler: async ({ ids }, { viewer }) => {
    // One by one: each deletion also removes images no longer used anywhere.
    for (const id of ids) await deleteLesson(viewer, id);
    revalidatePath("/lessons");
    return { count: ids.length };
  },
});

/** Library search for the editor's side panel (typed, strict input). */
export const searchLibraryAction = action({
  role: "COACH",
  input: z.strictObject({
    q: z.string().trim().max(100).optional(),
    material: z.string().trim().max(100).optional(),
    tags: z.array(z.uuid()).max(30).optional(),
    section: z.uuid().optional(),
    teamId: z.uuid().nullable(),
    durMax: z.int().min(0).max(600).optional(),
    kids: z.int().min(1).max(500).optional(),
    teamCount: z.int().min(1).max(50).optional(),
    difficulty: z.enum(Difficulty).optional(),
    page: z.int().min(1).max(10_000).optional(),
  }),
  handler: async ({ teamId, q, material, ...search }, { viewer }) => {
    const result = await searchBlocks(viewer.clubId, viewer.teams, {
      ...search,
      q: q || undefined,
      material: material || undefined,
      teamId,
    });
    return {
      total: result.total,
      page: result.page,
      pageCount: result.pageCount,
      items: result.items.map((b) => ({
        id: b.id,
        title: b.title,
        durationMinutes: b.durationMinutes,
        tags: b.tags.map((t) => t.name),
        material: b.material,
      })),
    };
  },
});

/** Full content of a library block, to be copied into the lesson. */
export const blockSnapshotAction = action({
  role: "COACH",
  input: z.strictObject({ blockId: z.uuid() }),
  handler: async ({ blockId }, { viewer }) => snapshotFromBlock(viewer, blockId),
});

export const overwriteBlockFromItemAction = action({
  role: "COACH",
  input: z.strictObject({ blockId: z.uuid(), item: lessonItemSchema }),
  handler: async ({ blockId, item }, { viewer }) => {
    await overwriteBlockFromItem(viewer, blockId, item);
    revalidatePath("/blocks");
    return null;
  },
});

export const createBlockFromItemAction = action({
  role: "COACH",
  input: z.strictObject({ item: lessonItemSchema, sectionId: z.uuid() }),
  handler: async ({ item, sectionId }, { viewer }) => {
    const block = await createBlockFromItem(viewer, item, sectionId);
    revalidatePath("/blocks");
    return block;
  },
});
