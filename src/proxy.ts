import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/** Reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = [
  /^\/login$/,
  /^\/invite\/[^/]+$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/api\/auth\//,
  // PDF renderer only; the page itself checks a one-time token.
  /^\/print\/lessons\/[0-9a-f-]{36}$/,
];

/**
 * Optimistic check only: redirects visitors without a session cookie to the
 * login page. The real check (valid session, role) happens in the data
 * access layer for every page, action and route.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => p.test(pathname))) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
