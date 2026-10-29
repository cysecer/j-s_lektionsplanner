import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  calendarWeeks,
  formatDateInput,
  normalizeTime,
  parseDateInput,
  weekdayShort,
} from "./date-input";

describe("normalizeTime", () => {
  it("accepts the usual ways of typing a time", () => {
    expect(normalizeTime("18")).toBe("18:00");
    expect(normalizeTime("9")).toBe("09:00");
    expect(normalizeTime("1730")).toBe("17:30");
    expect(normalizeTime("930")).toBe("09:30");
    expect(normalizeTime("9.5")).toBe("09:05");
    expect(normalizeTime("17h30")).toBe("17:30");
    expect(normalizeTime(" 17:30 ")).toBe("17:30");
    expect(normalizeTime("0:00")).toBe("00:00");
    expect(normalizeTime("")).toBe("");
  });

  it("leaves invalid input for the validation to report", () => {
    for (const raw of ["24:00", "17:60", "abc", "5pm", "12345"]) {
      expect(normalizeTime(raw)).toBe(raw);
    }
  });
});

describe("parseDateInput", () => {
  it("reads Swiss dates, short years, missing years and ISO", () => {
    expect(parseDateInput("28.11.2018", 2026)).toBe("2018-11-28");
    expect(parseDateInput("1.2.2026", 2026)).toBe("2026-02-01");
    expect(parseDateInput("28.11.18", 2026)).toBe("2018-11-28");
    expect(parseDateInput("28.11.", 2026)).toBe("2026-11-28");
    expect(parseDateInput("28.11", 2026)).toBe("2026-11-28");
    expect(parseDateInput("28112018", 2026)).toBe("2018-11-28");
    expect(parseDateInput("2018-11-28", 2026)).toBe("2018-11-28");
  });

  it("refuses dates that do not exist", () => {
    for (const raw of ["31.11.2026", "29.2.2026", "0.1.2026", "1.13.2026", "x", "", "1.1.1800"]) {
      expect(parseDateInput(raw, 2026), raw).toBeNull();
    }
    expect(parseDateInput("29.2.2028", 2026)).toBe("2028-02-29");
  });
});

describe("formatDateInput / weekdayShort", () => {
  it("formats dd.MM.yyyy with a short weekday per language", () => {
    expect(formatDateInput("2018-11-28")).toBe("28.11.2018");
    expect(formatDateInput("28.1")).toBe("28.1");
    expect(weekdayShort("2018-11-28", "de-CH")).toBe("Mi");
    expect(weekdayShort("2026-11-01", "de-CH")).toBe("So");
    expect(weekdayShort("2018-11-28", "fr-CH")).toBe("Mer");
    expect(weekdayShort("2018-11-28", "en-CH")).toBe("Wed");
    expect(weekdayShort("kein Datum", "de-CH")).toBe("");
  });
});

describe("calendar helpers", () => {
  it("lays out six weeks starting on Monday", () => {
    const weeks = calendarWeeks("2026-11-15");
    expect(weeks).toHaveLength(6);
    // 1 November 2026 is a Sunday: the first row starts on Monday 26 October.
    expect(weeks[0]![0]).toBe("2026-10-26");
    expect(weeks[0]![6]).toBe("2026-11-01");
    for (const week of weeks) expect(new Date(`${week[0]}T00:00:00Z`).getUTCDay()).toBe(1);
    // A month starting on Monday begins in the first cell.
    expect(calendarWeeks("2027-02-10")[0]![0]).toBe("2027-02-01");
  });

  it("moves by days and months across boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    // Around the DST switch the date stays the same calendar day.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });
});
