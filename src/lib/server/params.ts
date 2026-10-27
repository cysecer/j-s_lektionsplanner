import "server-only";
import { notFound } from "next/navigation";
import type { z } from "zod";

/**
 * Validates a page's `params` or `searchParams`. Invalid route params mean
 * the page does not exist; invalid search params fall back to `fallback`
 * (e.g. defaults) when given, else 404.
 */
export async function parsePageInput<S extends z.ZodType>(
  schema: S,
  input: Promise<unknown>,
  fallback?: z.output<S>,
): Promise<z.output<S>> {
  const parsed = schema.safeParse(await input);
  if (parsed.success) return parsed.data;
  if (fallback !== undefined) return fallback;
  notFound();
}
