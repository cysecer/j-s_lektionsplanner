/**
 * Security headers for every page and API response (set in src/proxy.ts).
 *
 * Content Security Policy: scripts only from the app itself with this
 * request's nonce (Next.js adds it to its own scripts); no inline event
 * handlers, no foreign origins, no embedding in other sites. Inline style
 * attributes stay allowed: drag and drop and popovers position elements
 * with them.
 */
export function contentSecurityPolicy(options: {
  nonce: string;
  https: boolean;
  dev: boolean;
}): string {
  return [
    "default-src 'self'",
    // React needs eval only in development (debug stacks).
    `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // data:/blob: for image previews before upload and for the PDF download.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function securityHeaders(options: { https: boolean }): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    // Nothing of this is used (the phone's file picker offers the camera itself).
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    ...(options.https
      ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
      : {}),
  };
}

/** A fresh, unguessable nonce per request (128 bits). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
