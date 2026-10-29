import { z } from "zod";
import { storage } from "@/lib/assets/service";
import { db } from "@/lib/db";
import { ActionFailure } from "@/lib/server/result";
import { route } from "@/lib/server/route";

/** GET /api/assets/:id – serves an image of the viewer's club. */
export const GET = route({
  role: "READER",
  params: z.strictObject({ id: z.uuid() }),
  handler: async ({ viewer, params }) => {
    const asset = await db.asset.findFirst({
      where: { id: params.id, clubId: viewer.clubId },
      select: { storageKey: true, mimeType: true },
    });
    if (!asset) throw new ActionFailure("notFound");
    const data = await storage.get(asset.storageKey);
    if (!data) throw new ActionFailure("notFound");

    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": asset.mimeType,
        "content-length": String(data.length),
        // Assets never change (new upload = new id), but they are private.
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "content-disposition": "inline",
      },
    });
  },
});
