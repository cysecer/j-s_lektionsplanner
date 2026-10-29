"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { DEFAULT_LAYOUT, layoutConfigSchema, parseLayoutConfig } from "@/lib/layout/schema";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";
import { displayName, idSchema } from "@/lib/settings/schemas";

const done = () => {
  revalidatePath("/settings/layout", "layout");
  revalidatePath("/lessons", "layout");
};

const layoutName = displayName(60);

async function assertNameFree(clubId: string, name: string, exceptId?: string) {
  const taken = await db.layout.count({
    where: {
      clubId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  if (taken > 0) {
    throw new ActionFailure("validation", "nameTaken", { name: ["validation.nameTaken"] });
  }
}

/** "Standard (Kopie)", "Standard (Kopie 2)", … within the 60-character limit. */
async function copyName(clubId: string, base: string, suffix: string) {
  const names = new Set(
    (await db.layout.findMany({ where: { clubId }, select: { name: true } })).map((l) =>
      l.name.toLowerCase(),
    ),
  );
  for (let n = 1; n < 100; n++) {
    const tail = n === 1 ? ` (${suffix})` : ` (${suffix} ${n})`;
    const name = base.slice(0, 60 - tail.length) + tail;
    if (!names.has(name.toLowerCase())) return name;
  }
  throw new ActionFailure("conflict");
}

/** A new layout starts as a copy of the paper template. */
export const createLayoutAction = action({
  role: "ADMIN",
  input: z.strictObject({ name: layoutName }),
  handler: async ({ name }, { viewer }) => {
    await assertNameFree(viewer.clubId, name);
    const layout = await db.layout.create({
      data: { clubId: viewer.clubId, name, config: layoutConfigSchema.parse(DEFAULT_LAYOUT) },
      select: { id: true },
    });
    // The first layout of a club becomes its default.
    await db.club.updateMany({
      where: { id: viewer.clubId, defaultLayoutId: null },
      data: { defaultLayoutId: layout.id },
    });
    done();
    return { id: layout.id };
  },
});

export const duplicateLayoutAction = action({
  role: "ADMIN",
  input: idSchema.extend({ suffix: z.string().trim().min(1).max(20) }),
  handler: async ({ id, suffix }, { viewer }) => {
    const source = await db.layout.findFirst({
      where: { id, clubId: viewer.clubId },
      select: { name: true, config: true },
    });
    if (!source) throw new ActionFailure("notFound");
    const layout = await db.layout.create({
      data: {
        clubId: viewer.clubId,
        name: await copyName(viewer.clubId, source.name, suffix),
        config: parseLayoutConfig(source.config),
      },
      select: { id: true },
    });
    done();
    return { id: layout.id };
  },
});

/**
 * Saves name and configuration. Custom fields must be active fields of the
 * club; archived or foreign ones are rejected.
 */
export const saveLayoutAction = action({
  role: "ADMIN",
  input: z.strictObject({ id: z.uuid(), name: layoutName, config: layoutConfigSchema }),
  handler: async ({ id, name, config }, { viewer }) => {
    const exists = await db.layout.count({ where: { id, clubId: viewer.clubId } });
    if (!exists) throw new ActionFailure("notFound");
    await assertNameFree(viewer.clubId, name, id);

    const customIds = config.columns
      .flatMap((c) => c.fields)
      .map((f) => f.field)
      .filter((f) => f.startsWith("custom:"))
      .map((f) => f.slice("custom:".length));
    if (customIds.length > 0) {
      const active = await db.customField.count({
        where: { clubId: viewer.clubId, archivedAt: null, id: { in: customIds } },
      });
      if (active !== customIds.length) throw new ActionFailure("validation", "unknownField");
    }

    await db.layout.update({ where: { id }, data: { name, config } });
    done();
    return null;
  },
});

export const setDefaultLayoutAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    const exists = await db.layout.count({ where: { id, clubId: viewer.clubId } });
    if (!exists) throw new ActionFailure("notFound");
    await db.club.update({ where: { id: viewer.clubId }, data: { defaultLayoutId: id } });
    done();
    return null;
  },
});

/** The default layout stays; lessons using a deleted layout fall back to the default. */
export const deleteLayoutAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    const club = await db.club.findUniqueOrThrow({
      where: { id: viewer.clubId },
      select: { defaultLayoutId: true },
    });
    if (club.defaultLayoutId === id) throw new ActionFailure("conflict", "layoutIsDefault");
    const { count } = await db.layout.deleteMany({ where: { id, clubId: viewer.clubId } });
    if (count === 0) throw new ActionFailure("notFound");
    done();
    return null;
  },
});
