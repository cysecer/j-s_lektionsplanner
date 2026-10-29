"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";
import { assertFound, assertSameIds, nextSortOrder } from "@/lib/settings/helpers";
import {
  customFieldSchema,
  customFieldUpdateSchema,
  FILTERABLE_TYPES,
  idSchema,
  reorderSchema,
  SEARCHABLE_TYPES,
} from "@/lib/settings/schemas";
import type { CustomFieldType } from "@/generated/prisma/enums";

/** Search/filter flags only where the type supports them. */
function flagsFor(type: CustomFieldType, searchable: boolean, filterable: boolean) {
  return {
    searchable: searchable && SEARCHABLE_TYPES.includes(type),
    filterable: filterable && FILTERABLE_TYPES.includes(type),
  };
}

const done = () => {
  revalidatePath("/settings/fields");
  return null;
};

export const createCustomFieldAction = action({
  role: "ADMIN",
  input: customFieldSchema,
  handler: async ({ label, type, searchable, filterable }, { viewer }) => {
    const existing = await db.customField.findMany({
      where: { clubId: viewer.clubId },
      select: { sortOrder: true },
    });
    await db.customField.create({
      data: {
        clubId: viewer.clubId,
        label,
        type,
        ...flagsFor(type, searchable, filterable),
        sortOrder: nextSortOrder(existing),
      },
    });
    return done();
  },
});

export const updateCustomFieldAction = action({
  role: "ADMIN",
  input: customFieldUpdateSchema,
  handler: async ({ id, label, searchable, filterable }, { viewer }) => {
    const field = await db.customField.findFirst({
      where: { id, clubId: viewer.clubId },
      select: { type: true },
    });
    if (!field) throw new ActionFailure("notFound");
    await db.customField.update({
      where: { id },
      data: { label, ...flagsFor(field.type, searchable, filterable) },
    });
    return done();
  },
});

export const reorderCustomFieldsAction = action({
  role: "ADMIN",
  input: reorderSchema,
  handler: async ({ ids }, { viewer }) => {
    const fields = await db.customField.findMany({
      where: { clubId: viewer.clubId, archivedAt: null },
      select: { id: true },
    });
    assertSameIds(
      ids,
      fields.map((f) => f.id),
    );
    await db.$transaction(
      ids.map((id, sortOrder) => db.customField.update({ where: { id }, data: { sortOrder } })),
    );
    return done();
  },
});

/** Archives fields that hold values in blocks or lessons, deletes unused ones. */
export const deleteCustomFieldAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    const field = await db.customField.findFirst({
      where: { id, clubId: viewer.clubId },
      select: { id: true },
    });
    if (!field) throw new ActionFailure("notFound");
    // Values live in JSON maps keyed by field id (parameterised query).
    const [usage] = await db.$queryRaw<{ used: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM "ProgramBlock" WHERE "clubId" = ${viewer.clubId}::uuid AND "customValues" ? ${id}
        UNION ALL
        SELECT 1 FROM "LessonItem" i JOIN "Lesson" l ON l.id = i."lessonId"
          WHERE l."clubId" = ${viewer.clubId}::uuid AND i."customValues" ? ${id}
      ) AS used`;
    const inUse = Boolean(usage?.used);
    if (inUse) {
      await db.customField.update({ where: { id }, data: { archivedAt: new Date() } });
    } else {
      await db.customField.delete({ where: { id } });
    }
    done();
    return { archived: inUse };
  },
});

export const restoreCustomFieldAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    const active = await db.customField.findMany({
      where: { clubId: viewer.clubId, archivedAt: null },
      select: { sortOrder: true },
    });
    assertFound(
      await db.customField.updateMany({
        where: { id, clubId: viewer.clubId, archivedAt: { not: null } },
        data: { archivedAt: null, sortOrder: nextSortOrder(active) },
      }),
    );
    return done();
  },
});
