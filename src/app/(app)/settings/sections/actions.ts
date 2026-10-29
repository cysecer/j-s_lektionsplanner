"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";
import { assertFound, assertSameIds, nextSortOrder } from "@/lib/settings/helpers";
import {
  idSchema,
  reorderSchema,
  sectionSchema,
  sectionUpdateSchema,
} from "@/lib/settings/schemas";

const done = () => {
  revalidatePath("/settings/sections");
  return null;
};

export const createSectionAction = action({
  role: "ADMIN",
  input: sectionSchema,
  handler: async ({ name }, { viewer }) => {
    const existing = await db.section.findMany({
      where: { clubId: viewer.clubId },
      select: { sortOrder: true },
    });
    await db.section.create({
      data: { clubId: viewer.clubId, name, sortOrder: nextSortOrder(existing) },
    });
    return done();
  },
});

/** Built-in sections may go back to their translated name (null); custom ones need a name. */
export const updateSectionAction = action({
  role: "ADMIN",
  input: sectionUpdateSchema,
  handler: async ({ id, name }, { viewer }) => {
    const section = await db.section.findFirst({
      where: { id, clubId: viewer.clubId },
      select: { builtin: true },
    });
    if (!section) throw new ActionFailure("notFound");
    if (name === null && !section.builtin) {
      throw new ActionFailure("validation", "nameRequired", { name: ["validation.required"] });
    }
    await db.section.update({ where: { id }, data: { name } });
    return done();
  },
});

export const reorderSectionsAction = action({
  role: "ADMIN",
  input: reorderSchema,
  handler: async ({ ids }, { viewer }) => {
    const sections = await db.section.findMany({
      where: { clubId: viewer.clubId },
      select: { id: true },
    });
    assertSameIds(
      ids,
      sections.map((s) => s.id),
    );
    await db.$transaction(
      ids.map((id, sortOrder) => db.section.update({ where: { id }, data: { sortOrder } })),
    );
    return done();
  },
});

/** Only custom sections that no lesson uses can be deleted. */
export const deleteSectionAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    const section = await db.section.findFirst({
      where: { id, clubId: viewer.clubId },
      select: { builtin: true, _count: { select: { lessonItems: true } } },
    });
    if (!section) throw new ActionFailure("notFound");
    if (section.builtin) throw new ActionFailure("forbidden", "builtinSection");
    if (section._count.lessonItems > 0) throw new ActionFailure("conflict", "sectionInUse");
    assertFound(await db.section.deleteMany({ where: { id, clubId: viewer.clubId } }));
    return done();
  },
});
