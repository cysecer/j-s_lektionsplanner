import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { toLocale } from "@/i18n/translator";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { auth } from "./auth";
import { hasRole, permissionsFor, type Permissions } from "./roles";

/** The signed-in person as the app sees them: user + club membership. */
export type Viewer = {
  userId: string;
  sessionId: string;
  name: string;
  email: string;
  locale: Locale;
  clubId: string;
  role: Role;
  coachId: string | null;
  /** Team selected in the header; null = all teams. */
  activeTeamId: string | null;
  permissions: Permissions;
};

/**
 * Data access layer entry point. Reads and validates the session once per
 * request, enforces the absolute session lifetime and resolves the club
 * membership. Returns null when nobody (valid) is signed in.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;

  const { session, user } = result;
  const maxAgeMs = env.SESSION_MAX_HOURS * 60 * 60 * 1000;
  if (Date.now() - new Date(session.createdAt).getTime() > maxAgeMs) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  // Single club for now; with several clubs this becomes the active one.
  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { clubId: true, role: true, coachId: true, activeTeamId: true },
  });
  if (!membership) return null;

  return {
    userId: user.id,
    sessionId: session.id,
    name: user.name,
    email: user.email,
    locale: toLocale((user as { locale?: string }).locale),
    clubId: membership.clubId,
    role: membership.role,
    coachId: membership.coachId,
    activeTeamId: membership.activeTeamId,
    permissions: permissionsFor(membership.role),
  };
});

/** For pages: redirects to the login page or shows "forbidden". */
export async function requireViewer(minimumRole: Role = "READER"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!hasRole(viewer.role, minimumRole)) redirect("/forbidden");
  return viewer;
}
