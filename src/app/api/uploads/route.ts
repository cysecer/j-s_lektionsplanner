import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth/roles";
import { storeImage, sweepUnusedUploads, uploadPurposeSchema } from "@/lib/assets/service";
import { MAX_UPLOAD_BYTES } from "@/lib/images/process";
import { ActionFailure } from "@/lib/server/result";
import { route } from "@/lib/server/route";

/**
 * POST /api/uploads?purpose=logo|sketch|field  (multipart, single field "file")
 * Returns the new asset; attaching it happens in a separate, validated action.
 */
export const POST = route({
  role: "COACH",
  query: z.strictObject({ purpose: uploadPurposeSchema }),
  file: { maxBytes: MAX_UPLOAD_BYTES },
  handler: async ({ viewer, query, file }) => {
    if (query.purpose === "logo" && !hasRole(viewer.role, "ADMIN")) {
      throw new ActionFailure("forbidden");
    }
    const asset = await storeImage(viewer.clubId, file!, query.purpose);
    // Housekeeping must never make the upload itself fail.
    await sweepUnusedUploads(viewer.clubId).catch((error: unknown) =>
      console.error("[uploads] cleanup failed", error),
    );
    return NextResponse.json(asset, { status: 201 });
  },
});
