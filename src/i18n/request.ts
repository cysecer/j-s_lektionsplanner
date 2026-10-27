import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getViewer } from "@/lib/auth/session";
import { LOCALE_COOKIE, localeSchema, negotiateLocale, type Locale } from "./config";
import { loadMessages } from "./messages";

/** Signed-in users: their saved language. Otherwise cookie, then browser language. */
async function resolveLocale(): Promise<Locale> {
  const viewer = await getViewer();
  if (viewer) return viewer.locale;
  const fromCookie = localeSchema.safeParse((await cookies()).get(LOCALE_COOKIE)?.value);
  if (fromCookie.success) return fromCookie.data;
  return negotiateLocale((await headers()).get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Europe/Zurich",
  };
});
