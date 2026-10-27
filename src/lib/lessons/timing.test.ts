import { describe, expect, it } from "vitest";
import {
  clockTimeSchema,
  computeLessonTiming,
  formatClockTime,
  resolveLessonDefaults,
  type TimingInput,
} from "./timing";

/** The sample lesson "Spiele": 5 + 20 | 20 + 20 | 10 + 15 = 90 minutes. */
const sample: TimingInput = {
  startTimeMinutes: 18 * 60,
  plannedDurationMinutes: 90,
  sections: [
    {
      id: "intro",
      items: [
        { id: "info", durationMinutes: 5 },
        { id: "dschungel", durationMinutes: 20 },
      ],
    },
    {
      id: "main",
      items: [
        { id: "keulen", durationMinutes: 20 },
        { id: "matten", durationMinutes: 20 },
      ],
    },
    {
      id: "end",
      items: [
        { id: "appell", durationMinutes: 10 },
        { id: "heigo", durationMinutes: 15 },
      ],
    },
  ],
};

describe("computeLessonTiming", () => {
  it("computes clock times, section totals and an exact fit", () => {
    const t = computeLessonTiming(sample);
    expect(formatClockTime(t.items.info!.startTimeMinutes!)).toBe("18:00");
    expect(formatClockTime(t.items.keulen!.startTimeMinutes!)).toBe("18:25");
    expect(formatClockTime(t.items.appell!.startTimeMinutes!)).toBe("19:05");
    expect(formatClockTime(t.items.heigo!.startTimeMinutes!)).toBe("19:15");
    expect(formatClockTime(t.endTimeMinutes!)).toBe("19:30");
    expect(t.sections).toEqual({
      intro: { totalMinutes: 25, itemsWithoutDuration: 0 },
      main: { totalMinutes: 40, itemsWithoutDuration: 0 },
      end: { totalMinutes: 25, itemsWithoutDuration: 0 },
    });
    expect(t.totalMinutes).toBe(90);
    expect(t.differenceMinutes).toBe(0);
    expect(t.status).toBe("exact");
  });

  it("reports minutes left when the plan is shorter", () => {
    const t = computeLessonTiming({ ...sample, plannedDurationMinutes: 120 });
    expect(t.status).toBe("remaining");
    expect(t.differenceMinutes).toBe(30);
  });

  it("reports minutes over when the plan is longer", () => {
    const t = computeLessonTiming({ ...sample, plannedDurationMinutes: 75 });
    expect(t.status).toBe("over");
    expect(t.differenceMinutes).toBe(-15);
  });

  it("has no budget without a planned duration", () => {
    const t = computeLessonTiming({ ...sample, plannedDurationMinutes: null });
    expect(t.status).toBe("unplanned");
    expect(t.differenceMinutes).toBeNull();
  });

  it("omits clock times without a start time", () => {
    const t = computeLessonTiming({ ...sample, startTimeMinutes: null });
    expect(t.items.heigo).toEqual({ offsetMinutes: 75, startTimeMinutes: null });
    expect(t.endTimeMinutes).toBeNull();
  });

  it("counts items without a duration as zero and reports them", () => {
    const t = computeLessonTiming({
      startTimeMinutes: 600,
      plannedDurationMinutes: 30,
      sections: [
        {
          id: "s",
          items: [
            { id: "a", durationMinutes: null },
            { id: "b", durationMinutes: 10 },
          ],
        },
      ],
    });
    expect(t.items.b!.startTimeMinutes).toBe(600);
    expect(t.itemsWithoutDuration).toBe(1);
    expect(t.sections.s).toEqual({ totalMinutes: 10, itemsWithoutDuration: 1 });
    expect(t.differenceMinutes).toBe(20);
  });

  it("wraps clock times past midnight", () => {
    const t = computeLessonTiming({
      startTimeMinutes: 23 * 60 + 30,
      plannedDurationMinutes: null,
      sections: [
        {
          id: "s",
          items: [
            { id: "a", durationMinutes: 45 },
            { id: "b", durationMinutes: 5 },
          ],
        },
      ],
    });
    expect(formatClockTime(t.items.b!.startTimeMinutes!)).toBe("00:15");
  });

  it("handles an empty lesson", () => {
    const t = computeLessonTiming({
      startTimeMinutes: 1080,
      plannedDurationMinutes: 90,
      sections: [],
    });
    expect(t.totalMinutes).toBe(0);
    expect(t.differenceMinutes).toBe(90);
    expect(t.endTimeMinutes).toBe(1080);
  });
});

describe("clock time parsing", () => {
  it.each([
    ["18:00", 1080],
    ["00:00", 0],
    ["23:59", 1439],
    ["07:05", 425],
  ])("parses %s", (input, expected) => {
    expect(clockTimeSchema.parse(input)).toBe(expected);
  });

  it.each(["24:00", "18:60", "8:00", "18:0", "", "18:00 ", "abc", "-1:00"])(
    "rejects %j",
    (input) => {
      expect(clockTimeSchema.safeParse(input).success).toBe(false);
    },
  );

  it("formats and wraps", () => {
    expect(formatClockTime(0)).toBe("00:00");
    expect(formatClockTime(1440 + 65)).toBe("01:05");
    expect(formatClockTime(-30)).toBe("23:30");
  });
});

describe("resolveLessonDefaults", () => {
  const club = { defaultStartTimeMinutes: 1080, defaultDurationMinutes: 90 };

  it("uses club defaults without a team or team overrides", () => {
    expect(resolveLessonDefaults(club)).toEqual({ startTimeMinutes: 1080, durationMinutes: 90 });
    expect(
      resolveLessonDefaults(club, { defaultStartTimeMinutes: null, defaultDurationMinutes: null }),
    ).toEqual({ startTimeMinutes: 1080, durationMinutes: 90 });
  });

  it("lets a team override each value independently", () => {
    expect(
      resolveLessonDefaults(club, {
        defaultStartTimeMinutes: 17 * 60,
        defaultDurationMinutes: null,
      }),
    ).toEqual({ startTimeMinutes: 1020, durationMinutes: 90 });
  });
});
