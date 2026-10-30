import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, createNonce, securityHeaders } from "@/lib/server/security-headers";

/** Reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/invite\/[^/]+$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/api\/auth\//,
  // The club's favicon, also shown on the login page.
  /^\/api\/favicon$/,
  // PDF renderer only; the page itself checks a one-time token.
  /^\/print\/lessons\/[0-9a-f-]{36}$/,
];

const HTTPS = (process.env.APP_URL ?? "").startsWith("https://");
const DEV = process.env.NODE_ENV === "development";

/**
 * 1. Security headers incl. a Content Security Policy with a fresh nonce
 *    (Next.js reads it from the request header and adds it to its scripts).
 * 2. Optimistic check only: visitors without a session cookie go to the
 *    login page. The real check (valid session, role) happens in the data
 *    access layer for every page, action and route.
 */
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy({ nonce, https: HTTPS, dev: DEV });

  const { pathname, search } = request.nextUrl;
  let response: NextResponse;
  if (PUBLIC_PATHS.some((p) => p.test(pathname)) || getSessionCookie(request)) {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers } });
  } else {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    response = NextResponse.redirect(login);
  }

  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(securityHeaders({ https: HTTPS }))) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
