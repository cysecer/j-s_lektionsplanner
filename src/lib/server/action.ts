import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/roles";
import { ActionFailure, toFieldErrors, type ActionResult } from "./result";

type Handler<S extends z.ZodType, V, T> = (input: z.output<S>, ctx: { viewer: V }) => Promise<T>;

/**
 * The only way to define a server action. Every action
 *   1. validates its complete input with a zod schema (unknown keys rejected
 *      when the schema is strict),
 *   2. checks the session and the minimum role,
 *   3. returns a typed result instead of throwing to the client.
 * src/lib/server/enforcement.test.ts fails the build if an action bypasses this.
 */
export function action<S extends z.ZodType, T>(config: {
  input: S;
  role: Role;
  handler: Handler<S, Viewer, T>;
}): (raw: z.input<S>) => Promise<ActionResult<T>>;
export function action<S extends z.ZodType, T>(config: {
  input: S;
  role: "public";
  handler: Handler<S, Viewer | null, T>;
}): (raw: z.input<S>) => Promise<ActionResult<T>>;
export function action<S extends z.ZodType, T>(config: {
  input: S;
  role: Role | "public";
  handler: Handler<S, Viewer | null, T> | Handler<S, Viewer, T>;
}) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    const viewer = await getViewer();
    if (config.role !== "public") {
      if (!viewer) return { ok: false, error: "unauthorized" };
      if (!hasRole(viewer.role, config.role)) return { ok: false, error: "forbidden" };
    }

    const parsed = config.input.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "validation", fieldErrors: toFieldErrors(parsed.error) };
    }

    try {
      const data = await (config.handler as Handler<S, Viewer | null, T>)(parsed.data, { viewer });
      return { ok: true, data };
    } catch (error) {
      return toFailure(error);
    }
  };
}

export function toFailure(error: unknown): ActionResult<never> {
  if (error instanceof ActionFailure) {
    return { ok: false, error: error.kind, code: error.code, fieldErrors: error.fieldErrors };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { ok: false, error: "conflict" };
    if (error.code === "P2025") return { ok: false, error: "notFound" };
  }
  // Next.js uses thrown errors for redirect()/notFound(); let those through.
  if (error instanceof Error && "digest" in error && String(error.digest).startsWith("NEXT_")) {
    throw error;
  }
  console.error("[action] unexpected error", error);
  return { ok: false, error: "internal" };
}
