import { z } from "zod";

export const MINUTES_PER_DAY = 1440;

/** "HH:MM" (24h) ⇄ minutes after midnight. */
export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "validation.clockTime" })
  .transform((value) => {
    const [h, m] = value.split(":").map(Number);
    return h! * 60 + m!;
  });

export function formatClockTime(minutesAfterMidnight: number): string {
  const m = ((minutesAfterMidnight % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type LessonTimeDefaults = { startTimeMinutes: number; durationMinutes: number };

/** A team's own defaults win over the club's. */
export function resolveLessonDefaults(
  club: { defaultStartTimeMinutes: number; defaultDurationMinutes: number },
  team?: { defaultStartTimeMinutes: number | null; defaultDurationMinutes: number | null } | null,
): LessonTimeDefaults {
  return {
    startTimeMinutes: team?.defaultStartTimeMinutes ?? club.defaultStartTimeMinutes,
    durationMinutes: team?.defaultDurationMinutes ?? club.defaultDurationMinutes,
  };
}

export type TimingInput = {
  /** Sections in display order, each with its items in display order. */
  sections: { id: string; items: { id: string; durationMinutes: number | null }[] }[];
  /** Minutes after midnight; null hides clock times. */
  startTimeMinutes: number | null;
  /** Planned lesson length; null means "not planned", so no remaining/over. */
  plannedDurationMinutes: number | null;
};

export type BudgetStatus = "remaining" | "exact" | "over" | "unplanned";

export type LessonTiming = {
  items: Record<
    string,
    {
      /** Minutes from the lesson start. */
      offsetMinutes: number;
      /** Clock time (minutes after midnight, wrapped), or null without start time. */
      startTimeMinutes: number | null;
    }
  >;
  sections: Record<string, { totalMinutes: number; itemsWithoutDuration: number }>;
  totalMinutes: number;
  itemsWithoutDuration: number;
  endTimeMinutes: number | null;
  /** planned − total: positive = minutes left, negative = minutes too long. */
  differenceMinutes: number | null;
  status: BudgetStatus;
};

/**
 * Computes clock times, section totals and how far the plan is from the
 * planned duration. Items without a duration count as 0 minutes and are
 * reported so the UI can point them out.
 */
export function computeLessonTiming(input: TimingInput): LessonTiming {
  const items: LessonTiming["items"] = {};
  const sections: LessonTiming["sections"] = {};
  let offset = 0;
  let itemsWithoutDuration = 0;

  for (const section of input.sections) {
    let sectionTotal = 0;
    let sectionMissing = 0;
    for (const item of section.items) {
      items[item.id] = {
        offsetMinutes: offset,
        startTimeMinutes:
          input.startTimeMinutes === null
            ? null
            : (input.startTimeMinutes + offset) % MINUTES_PER_DAY,
      };
      if (item.durationMinutes === null) {
        sectionMissing += 1;
      } else {
        sectionTotal += item.durationMinutes;
        offset += item.durationMinutes;
      }
    }
    sections[section.id] = { totalMinutes: sectionTotal, itemsWithoutDuration: sectionMissing };
    itemsWithoutDuration += sectionMissing;
  }

  const differenceMinutes =
    input.plannedDurationMinutes === null ? null : input.plannedDurationMinutes - offset;
  const status: BudgetStatus =
    differenceMinutes === null
      ? "unplanned"
      : differenceMinutes > 0
        ? "remaining"
        : differenceMinutes < 0
          ? "over"
          : "exact";

  return {
    items,
    sections,
    totalMinutes: offset,
    itemsWithoutDuration,
    endTimeMinutes:
      input.startTimeMinutes === null ? null : (input.startTimeMinutes + offset) % MINUTES_PER_DAY,
    differenceMinutes,
    status,
  };
}
