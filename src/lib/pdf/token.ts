import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Access to the internal print page. The PDF renderer (a headless browser
 * on the server) has no session, so the PDF route hands it a token that is
 * signed, bound to one lesson, valid for a minute and usable once.
 */

const payloadSchema = z.strictObject({
  /** Nonce, for single use. */
  n: z.uuid(),
  clubId: z.uuid(),
  lessonId: z.uuid(),
  layoutId: z.uuid().nullable(),
  /** Expiry, ms since epoch. */
  exp: z.int().positive(),
});
export type PrintTokenPayload = z.infer<typeof payloadSchema>;

export const PRINT_TOKEN_TTL_MS = 60_000;

const key = (secret: string) => createHmac("sha256", secret).update("pdf-print-token").digest();
const sign = (secret: string, data: string) =>
  createHmac("sha256", key(secret)).update(data).digest("base64url");

export function createPrintToken(
  secret: string,
  input: Omit<PrintTokenPayload, "n" | "exp">,
  now = Date.now(),
): string {
  const payload: PrintTokenPayload = { ...input, n: randomUUID(), exp: now + PRINT_TOKEN_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(secret, data)}`;
}

/** The payload if signature and expiry are valid; null otherwise. Does not consume. */
export function readPrintToken(
  secret: string,
  token: string,
  now = Date.now(),
): PrintTokenPayload | null {
  if (token.length > 2000) return null;
  const [data, signature, ...rest] = token.split(".");
  if (!data || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(secret, data));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success || parsed.data.exp < now) return null;
  return parsed.data;
}

/**
 * Remembers used nonces until they expire. One app process renders its own
 * PDFs (the browser calls back into the same instance), so memory suffices.
 */
export class NonceRegistry {
  private readonly used = new Map<string, number>();

  /** true the first time a nonce is seen, false afterwards. */
  consume(nonce: string, expiresAt: number, now = Date.now()): boolean {
    for (const [n, exp] of this.used) if (exp < now) this.used.delete(n);
    if (this.used.has(nonce)) return false;
    this.used.set(nonce, expiresAt);
    return true;
  }
}
