import { createTranslator } from "use-intl/core";
import { DEFAULT_LOCALE, localeSchema, type Locale } from "./config";
import { loadMessages, type Messages } from "./messages";

/** Coerces a stored or user-supplied locale string to a supported locale. */
export function toLocale(value: string | null | undefined): Locale {
  const parsed = localeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_LOCALE;
}

/** Translator for code outside React rendering (emails, PDF labels). */
export async function getTranslator(locale: Locale) {
  const messages = (await loadMessages(locale)) as Messages;
  return createTranslator({ locale, messages });
}
