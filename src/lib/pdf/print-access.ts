import "server-only";
import { env } from "@/lib/env";
import { createPrintToken, NonceRegistry, readPrintToken, type PrintTokenPayload } from "./token";

// Shared across route and page bundles of the same process.
const globalForPdf = globalThis as unknown as { pdfPrintNonces?: NonceRegistry };
const nonces = (globalForPdf.pdfPrintNonces ??= new NonceRegistry());

export function issuePrintToken(input: Omit<PrintTokenPayload, "n" | "exp">) {
  return createPrintToken(env.AUTH_SECRET, input);
}

/** Valid, unexpired, for this lesson, and not used before; else null. */
export function consumePrintToken(token: string, lessonId: string): PrintTokenPayload | null {
  const payload = readPrintToken(env.AUTH_SECRET, token);
  if (!payload || payload.lessonId !== lessonId) return null;
  return nonces.consume(payload.n, payload.exp) ? payload : null;
}
