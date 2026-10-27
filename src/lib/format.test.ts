import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, formatTimeOfDay, toIsoDate } from "./format";

const sampleDate = new Date("2018-11-28T00:00:00Z");

describe("formatDate", () => {
  it.each([
    ["de-CH", "28.11.2018"],
    ["fr-CH", "28.11.2018"],
    ["it-CH", "28.11.2018"],
    ["en", "28.11.2018"],
  ] as const)("formats %s as %s", (locale, expected) => {
    expect(formatDate(sampleDate, locale)).toBe(expected);
  });

  it("formats Romansh with its own conventions", () => {
    expect(formatDate(sampleDate, "rm")).toMatch(/^28.11.2018$/);
  });

  it("never shifts the calendar day by the time zone", () => {
    expect(formatDate(new Date("2018-11-28T00:00:00Z"), "de-CH")).toBe("28.11.2018");
  });

  it("formats long dates per language", () => {
    expect(formatDate(sampleDate, "de-CH", "long")).toBe("Mittwoch, 28. November 2018");
    expect(formatDate(sampleDate, "fr-CH", "long")).toMatch(/mercredi.*28 novembre 2018/);
  });
});

describe("other formats", () => {
  it("uses Swiss grouping for German", () => {
    expect(formatNumber(1234.5, "de-CH")).toBe("1'234.5");
  });

  it("writes clock times as HH:MM", () => {
    expect(formatTimeOfDay(19 * 60 + 15)).toBe("19:15");
  });

  it("produces ISO dates for file names", () => {
    expect(toIsoDate(sampleDate)).toBe("2018-11-28");
  });
});
