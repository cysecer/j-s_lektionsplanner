/**
 * Parsing and formatting for the date and time fields. Browsers render
 * <input type="date|time"> in the operating system's locale (AM/PM,
 * MM/DD/YYYY), so the app uses text fields with one fixed format instead:
 * dates dd.MM.yyyy with the weekday, times HH:MM (24 h).
 */

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "18" → "18:00", "1730" → "17:30", "9.5" → "09:05", "17h30" → "17:30".
 * Anything that is not a valid time is returned unchanged (the form's
 * validation reports it).
 */
export function normalizeTime(raw: string): string {
  const value = raw.trim();
  if (value === "") return "";
  let hours: number;
  let minutes: number;
  const separated = /^(\d{1,2})\s*[:.hH]\s*(\d{1,2})?$/.exec(value);
  if (separated) {
    hours = Number(separated[1]);
    minutes = Number(separated[2] ?? 0);
  } else if (/^\d{1,4}$/.test(value)) {
    hours = Number(value.length <= 2 ? value : value.slice(0, -2));
    minutes = value.length <= 2 ? 0 : Number(value.slice(-2));
  } else {
    return raw;
  }
  if (hours > 23 || minutes > 59) return raw;
  return `${pad(hours)}:${pad(minutes)}`;
}

function isoOf(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * "28.11.2018", "28.11.18", "28.11." (this year), "28112018" or ISO
 * "2018-11-28" → "2018-11-28"; null when it is no real calendar date.
 */
export function parseDateInput(raw: string, currentYear: number): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const swiss = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4})?)?$/.exec(value);
  const digits = /^(\d{2})(\d{2})(\d{4}|\d{2})$/.exec(value);
  const parts = swiss ?? digits;
  if (!parts) return null;
  const year = parts[3] ? Number(parts[3]) + (parts[3].length === 2 ? 2000 : 0) : currentYear;
  return isoOf(year, Number(parts[2]), Number(parts[1]));
}

/** "2018-11-28" → "28.11.2018"; other input is returned unchanged. */
export function formatDateInput(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : value;
}

/** Short weekday of an ISO date: "Mi", "Mer", "Wed" (capitalised, no dot). */
export function weekdayShort(iso: string, formatLocale: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  const name = new Intl.DateTimeFormat(formatLocale, { weekday: "short", timeZone: "UTC" })
    .format(date)
    .replace(/\.$/, "");
  return name.charAt(0).toLocaleUpperCase(formatLocale) + name.slice(1);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const fromIso = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** ISO date `days` later (or earlier, when negative). */
export function addDays(iso: string, days: number): string {
  return toIso(new Date(fromIso(iso).getTime() + days * DAY_MS));
}

/** Same day `months` later, clamped to the month's end (31.1. + 1 → 28./29.2.). */
export function addMonths(iso: string, months: number): string {
  const date = fromIso(iso);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return toIso(target);
}

/**
 * The six weeks shown for the month of `iso`, Monday first (as usual in
 * Switzerland), including the days of the neighbouring months.
 */
export function calendarWeeks(iso: string): string[][] {
  const date = fromIso(iso);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = toIso(new Date(first.getTime() - mondayOffset * DAY_MS));
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  );
}
