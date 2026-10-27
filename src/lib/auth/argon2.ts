import "server-only";
import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane).
const options = {
  algorithm: 2, // Algorithm.Argon2id (const enum, not importable with isolatedModules)
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

// NIST: normalise Unicode before hashing so "ü" typed differently still matches.
export function hashPassword(password: string): Promise<string> {
  return hash(password.normalize("NFKC"), options);
}

export async function verifyPassword({
  hash: digest,
  password,
}: {
  hash: string;
  password: string;
}) {
  try {
    return await verify(digest, password.normalize("NFKC"));
  } catch {
    return false;
  }
}
