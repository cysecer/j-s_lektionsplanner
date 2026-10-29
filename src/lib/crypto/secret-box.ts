import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encrypts secrets the server must use again later (the SMTP password), so
 * they cannot be hashed. AES-256-GCM with a key derived from the server
 * secret; `context` (e.g. the club id) is authenticated too, so a value
 * copied to another row does not decrypt.
 *
 * Format: "v1.<iv>.<tag>.<ciphertext>", each part base64url.
 */

const VERSION = "v1";

function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "lektionsplaner", `secret-box:${purpose}`, 32));
}

export function sealSecret(
  secret: string,
  purpose: string,
  context: string,
  plaintext: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, purpose), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

/** The plaintext, or null when the value was tampered with or the key changed. */
export function openSecret(
  secret: string,
  purpose: string,
  context: string,
  sealed: string,
): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const [iv, tag, data] = parts.slice(1).map((p) => Buffer.from(p, "base64url"));
    if (iv!.length !== 12 || tag!.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, purpose), iv!);
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag!);
    return Buffer.concat([decipher.update(data!), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
