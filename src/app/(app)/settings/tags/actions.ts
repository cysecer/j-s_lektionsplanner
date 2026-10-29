"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { action } from "@/lib/server/action";
import { assertFound } from "@/lib/settings/helpers";
import { idSchema, tagSchema, tagUpdateSchema } from "@/lib/settings/schemas";

const done = () => {
  revalidatePath("/settings/tags");
  return null;
};

export const createTagAction = action({
  role: "ADMIN",
  input: tagSchema,
  handler: async ({ name }, { viewer }) => {
    await db.tag.create({ data: { clubId: viewer.clubId, name } });
    return done();
  },
});

export const updateTagAction = action({
  role: "ADMIN",
  input: tagUpdateSchema,
  handler: async ({ id, name }, { viewer }) => {
    assertFound(await db.tag.updateMany({ where: { id, clubId: viewer.clubId }, data: { name } }));
    return done();
  },
});

/** Tags carry no history; deleting removes them from all blocks. */
export const deleteTagAction = action({
  role: "ADMIN",
  input: idSchema,
  handler: async ({ id }, { viewer }) => {
    assertFound(await db.tag.deleteMany({ where: { id, clubId: viewer.clubId } }));
    return done();
  },
});
