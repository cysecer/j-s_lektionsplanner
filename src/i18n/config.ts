import { z } from "zod";

/**
 * Supported UI languages. Adding a language = add its code here and a
 * messages/<code>.json file. Missing keys fall back to German.
 */
export const LOCALES = ["de-CH", "fr-CH", "it-CH", "rm", "en"] as const;
export const DEFAULT_LOCALE = "de-CH" satisfies Locale;
export const LOCALE_COOKIE = "NEXT_LOCALE";

export type Locale = (typeof LOCALES)[number];

export const localeSchema = z.enum(LOCALES);

/**
 * Locale used for date/number formatting. Romansh has no complete CLDR data
 * in all runtimes, so it formats like Swiss German.
 */
export const FORMAT_LOCALE: Record<Locale, string> = {
  "de-CH": "de-CH",
  "fr-CH": "fr-CH",
  "it-CH": "it-CH",
  rm: "de-CH",
  en: "en-CH",
};

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const requested = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of requested) {
    const exact = LOCALES.find((l) => l.toLowerCase() === tag);
    if (exact) return exact;
    const language = tag.split("-")[0];
    const sameLanguage = LOCALES.find((l) => l.toLowerCase().split("-")[0] === language);
    if (sameLanguage) return sameLanguage;
  }
  return DEFAULT_LOCALE;
}
