import { z } from "zod";

/**
 * A same-origin path to return to after sign-in. Rejects absolute URLs,
 * protocol-relative URLs ("//evil.example") and backslash tricks, so the
 * value can never send the user to another site (open redirect).
 */
export const safeRedirectPathSchema = z
  .string()
  .max(500)
  .regex(/^\/(?![/\\])[^\\\s]*$/);

export function safeRedirectPath(value: unknown, fallback = "/"): string {
  const parsed = safeRedirectPathSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
