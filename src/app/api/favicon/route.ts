import { z } from "zod";
import { FAVICON_SIZES, renderFavicon } from "@/lib/club/favicon";
import { ActionFailure } from "@/lib/server/result";
import { route } from "@/lib/server/route";

/**
 * GET /api/favicon?size=32|180[&v=<asset id>] – the club's favicon as PNG.
 * Public: browsers request it on the login page too. `v` only changes the
 * URL when the icon changes, so it can be cached for a long time.
 */
export const GET = route({
  role: "public",
  query: z.strictObject({
    size: z.enum(FAVICON_SIZES.map(String) as ["32", "180"]).transform(Number),
    v: z.uuid().optional(),
  }),
  handler: async ({ query }) => {
    const png = await renderFavicon(query.size as 32 | 180);
    if (!png) throw new ActionFailure("notFound");
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "content-length": String(png.length),
        "cache-control": query.v ? "public, max-age=31536000, immutable" : "public, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  },
});
