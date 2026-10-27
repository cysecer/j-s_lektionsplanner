import type { AbstractIntlMessages } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "./config";
import de from "../../messages/de-CH.json";

export type Messages = typeof de;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep merge: keys missing in `override` keep the German text. */
export function mergeMessages(base: AbstractIntlMessages, override: AbstractIntlMessages) {
  const result: AbstractIntlMessages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = base[key];
    result[key] =
      isObject(baseValue) && isObject(value)
        ? mergeMessages(baseValue as AbstractIntlMessages, value as AbstractIntlMessages)
        : value;
  }
  return result;
}

export async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  if (locale === DEFAULT_LOCALE) return de;
  try {
    const localized = (await import(`../../messages/${locale}.json`)) as {
      default: AbstractIntlMessages;
    };
    return mergeMessages(de, localized.default);
  } catch {
    return de;
  }
}
