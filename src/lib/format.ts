import { FORMAT_LOCALE, type Locale } from "@/i18n/config";
import { formatClockTime } from "@/lib/lessons/timing";

/**
 * Locale-aware formatting used by the UI and the PDF. Dates are plain
 * calendar dates (stored as UTC midnight), so they are formatted in UTC.
 */

export function formatDate(date: Date, locale: Locale, style: "short" | "long" = "short"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }
      : { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(FORMAT_LOCALE[locale], options).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(FORMAT_LOCALE[locale]).format(value);
}

/** Clock times are written HH:MM in all supported languages. */
export function formatTimeOfDay(minutesAfterMidnight: number): string {
  return formatClockTime(minutesAfterMidnight);
}

/** ISO date (YYYY-MM-DD) for file names and form inputs. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
