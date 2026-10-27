import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { hasRole } from "@/lib/auth/roles";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { toFailure } from "./action";
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

/**
 * The only way to define a route handler. Validates path params, query
 * string and JSON body with zod (each defaults to "must be empty"), checks
 * the session and role, and maps failures to JSON errors.
 */
export function route<
  P extends z.ZodType = Empty,
  Q extends z.ZodType = Empty,
  B extends z.ZodType = Empty,
>(config: {
  role: Role;
  params?: P;
  query?: Q;
  body?: B;
  maxBodyBytes?: number;
  handler: (ctx: {
    request: NextRequest;
    viewer: Viewer;
    params: z.output<P>;
    query: z.output<Q>;
    body: z.output<B>;
  }) => Promise<Response>;
}) {
  return async (request: NextRequest, context: { params: Promise<unknown> }) => {
    const viewer = await getViewer();
    if (!viewer) return fail("unauthorized");
    if (!hasRole(viewer.role, config.role)) return fail("forbidden");

    const params = (config.params ?? empty).safeParse((await context.params) ?? {});
    const query = (config.query ?? empty).safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!params.success) return fail("notFound");
    if (!query.success) return fail("validation", { fieldErrors: toFieldErrors(query.error) });

    let rawBody: unknown = {};
    if (config.body) {
      const text = await request.text();
      if (text.length > (config.maxBodyBytes ?? 100_000)) return fail("validation");
      try {
        rawBody = text ? JSON.parse(text) : {};
      } catch {
        return fail("validation");
      }
    }
    const body = (config.body ?? z.unknown()).safeParse(rawBody);
    if (!body.success) return fail("validation", { fieldErrors: toFieldErrors(body.error) });

    try {
      return await config.handler({
        request,
        viewer,
        params: params.data as z.output<P>,
        query: query.data as z.output<Q>,
        body: body.data as z.output<B>,
      });
    } catch (error) {
      const result = toFailure(error);
      return result.ok ? fail("internal") : fail(result.error, { code: result.code });
    }
  };
}
