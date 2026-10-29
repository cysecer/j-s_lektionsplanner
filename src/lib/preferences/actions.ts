"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE, localeSchema } from "@/i18n/config";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { visibleTeamsWhere } from "@/lib/lessons/visibility";
import { action } from "@/lib/server/action";
import { ActionFailure } from "@/lib/server/result";

/** UI language: saved on the account when signed in, else in a cookie. */
export const setLocaleAction = action({
  role: "public",
  input: z.strictObject({ locale: localeSchema }),
  handler: async ({ locale }, { viewer }) => {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: env.APP_URL.startsWith("https://"),
      httpOnly: true,
    });
    if (viewer) await db.user.update({ where: { id: viewer.userId }, data: { locale } });
    return null;
  },
});

/** Team filter in the header; null shows all teams. */
export const setActiveTeamAction = action({
  role: "READER",
  input: z.strictObject({ teamId: z.uuid().nullable() }),
  handler: async ({ teamId }, { viewer }) => {
    if (teamId) {
      const team = await db.team.findFirst({
        where: { AND: [visibleTeamsWhere(viewer), { id: teamId }] },
        select: { id: true },
      });
      if (!team) throw new ActionFailure("notFound");
    }
    await db.membership.update({
      where: { userId_clubId: { userId: viewer.userId, clubId: viewer.clubId } },
      data: { activeTeamId: teamId },
    });
    return null;
  },
});
