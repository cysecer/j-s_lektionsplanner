import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { hasRole } from "@/lib/auth/roles";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { toFailure } from "./action";
import { readBodyLimited } from "./read-body";
import { toFieldErrors, type ActionErrorKind } from "./result";

const STATUS: Record<ActionErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  rateLimited: 429,
  internal: 500,
};

const empty = z.strictObject({});
type Empty = typeof empty;

function fail(error: ActionErrorKind, extra?: object) {
  return NextResponse.json({ error, ...extra }, { status: STATUS[error] });
}

const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * The only way to define a route handler. Validates path params, query
 * string and the body with zod (each defaults to "must be empty"), checks
 * the session and role, and maps failures to JSON errors.
 *
 * The body is either JSON (`body` schema) or a single uploaded file
 * (`file` option, multipart field "file"). Bodies are read with a hard size
 * limit: reading stops as soon as the limit is exceeded.
 */
export function route<
  R extends Role | "public",
  P extends z.ZodType = Empty,
  Q extends z.ZodType = Empty,
  B extends z.ZodType = Empty,
>(config: {
  /** "public": no session needed (e.g. the club's favicon on the login page). */
  role: R;
  params?: P;
  query?: Q;
  body?: B;
  maxBodyBytes?: number;
  file?: { maxBytes: number };
  handler: (ctx: {
    request: NextRequest;
    viewer: R extends "public" ? Viewer | null : Viewer;
    params: z.output<P>;
    query: z.output<Q>;
    body: z.output<B>;
    file: Buffer | null;
  }) => Promise<Response>;
}) {
  if (config.body && config.file) throw new Error("route(): use either body or file");

  return async (request: NextRequest, context: { params: Promise<unknown> }) => {
    const viewer = await getViewer();
    if (config.role !== "public") {
      if (!viewer) return fail("unauthorized");
      if (!hasRole(viewer.role, config.role)) return fail("forbidden");
    }

    const params = (config.params ?? empty).safeParse((await context.params) ?? {});
    const query = (config.query ?? empty).safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!params.success) return fail("notFound");
    if (!query.success) return fail("validation", { fieldErrors: toFieldErrors(query.error) });

    let rawBody: unknown = {};
    let file: Buffer | null = null;

    if (config.body) {
      const bytes = await readBodyLimited(request, config.maxBodyBytes ?? 100_000);
      if (!bytes) return fail("validation", { code: "tooLarge" });
      try {
        rawBody = bytes.length ? JSON.parse(bytes.toString("utf8")) : {};
      } catch {
        return fail("validation");
      }
    }

    if (config.file) {
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.startsWith("multipart/form-data")) return fail("validation");
      const bytes = await readBodyLimited(request, config.file.maxBytes + MULTIPART_OVERHEAD);
      if (!bytes) return fail("validation", { code: "tooLarge" });
      let form: FormData;
      try {
        form = await new Response(new Uint8Array(bytes), {
          headers: { "content-type": contentType },
        }).formData();
      } catch {
        return fail("validation");
      }
      const entries = [...form.keys()];
      const upload = form.get("file");
      if (entries.length !== 1 || !(upload instanceof File)) return fail("validation");
      if (upload.size === 0 || upload.size > config.file.maxBytes) {
        return fail("validation", { code: "tooLarge" });
      }
      file = Buffer.from(await upload.arrayBuffer());
    }

    const body = (config.body ?? z.unknown()).safeParse(rawBody);
    if (!body.success) return fail("validation", { fieldErrors: toFieldErrors(body.error) });

    try {
      return await config.handler({
        request,
        viewer: viewer as R extends "public" ? Viewer | null : Viewer,
        params: params.data as z.output<P>,
        query: query.data as z.output<Q>,
        body: body.data as z.output<B>,
        file,
      });
    } catch (error) {
      const result = toFailure(error);
      return result.ok ? fail("internal") : fail(result.error, { code: result.code });
    }
  };
}
