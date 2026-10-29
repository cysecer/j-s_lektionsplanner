const zurich = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Zurich wall-clock time of an instant, read as if it were UTC (ms). */
function wallClock(instant: Date): { ms: number; midnight: number } {
  const parts = zurich.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const [y, m, d] = [get("year"), get("month") - 1, get("day")];
  return {
    ms: Date.UTC(y, m, d, get("hour"), get("minute"), get("second")),
    midnight: Date.UTC(y, m, d),
  };
}

/** UTC offset of Zurich at an instant (ms; +1 h in winter, +2 h in summer). */
const offsetAt = (instant: Date) =>
  wallClock(instant).ms - Math.floor(instant.getTime() / 1000) * 1000;

/** Start of the calendar day in Zurich that contains `now`, as a UTC instant. */
export function startOfZurichDay(now: Date): Date {
  const { midnight } = wallClock(now);
  // The offset at midnight can differ from now's on daylight-saving days.
  const guess = new Date(midnight - offsetAt(now));
  return new Date(midnight - offsetAt(guess));
}
