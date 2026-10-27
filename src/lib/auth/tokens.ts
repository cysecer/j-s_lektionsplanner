import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/** 256-bit random token, URL-safe (43 characters). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are stored only as SHA-256 hashes; a database leak reveals no usable link. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
