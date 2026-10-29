import { describe, expect, it } from "vitest";
import { formatDateInput, normalizeTime, parseDateInput, weekdayShort } from "./date-input";

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
