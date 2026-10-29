"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { addDays, addMonths, calendarWeeks, weekdayShort } from "@/lib/date-input";
import { cn } from "@/lib/utils";

const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());

/**
 * Month calendar, weeks starting on Monday. Keyboard: arrows move by day
 * and week, Page Up/Down by month, Home/End to the week's start/end,
 * Enter or Space picks the day.
 */
export function Calendar({
  value,
  onSelect,
  formatLocale,
}: {
  /** Selected ISO date, if any. */
  value: string | null;
  onSelect: (iso: string) => void;
  formatLocale: string;
}) {
  const t = useTranslations("common");
  const today = todayIso();
  const [focused, setFocused] = useState(value ?? today);
  const grid = useRef<HTMLTableElement>(null);
  const weeks = calendarWeeks(focused);
  const month = focused.slice(0, 7);

  // Keep keyboard focus on the focused day while moving through the month.
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused]);

  const title = new Intl.DateTimeFormat(formatLocale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${focused}T00:00:00Z`));
  const fullDate = (iso: string) =>
    new Intl.DateTimeFormat(formatLocale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));

  function onKeyDown(event: KeyboardEvent) {
    const weekday = (new Date(`${focused}T00:00:00Z`).getUTCDay() + 6) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
      Home: () => addDays(focused, -weekday),
      End: () => addDays(focused, 6 - weekday),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setFocused(move());
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label={t("previousMonth")}
          onClick={() => setFocused(addMonths(focused, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <p className="text-sm font-medium" aria-live="polite">
          {title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label={t("nextMonth")}
          onClick={() => setFocused(addMonths(focused, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <table
        ref={grid}
        role="grid"
        aria-label={title}
        className="border-collapse"
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {weeks[0]!.map((iso) => (
              <th
                key={iso}
                scope="col"
                className="text-muted-foreground size-9 text-xs font-normal"
              >
                {weekdayShort(iso, formatLocale)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((iso) => {
                const selected = iso === value;
                const outside = iso.slice(0, 7) !== month;
                return (
                  <td key={iso} className="p-0.5">
                    <button
                      type="button"
                      data-day={iso}
                      tabIndex={iso === focused ? 0 : -1}
                      aria-label={fullDate(iso)}
                      aria-pressed={selected}
                      aria-current={iso === today ? "date" : undefined}
                      onClick={() => onSelect(iso)}
                      className={cn(
                        "focus-visible:ring-ring/50 flex size-9 items-center justify-center rounded-md text-sm tabular-nums outline-none focus-visible:ring-3",
                        selected ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                        outside && !selected && "text-muted-foreground/60",
                        iso === today && !selected && "font-semibold underline underline-offset-4",
                      )}
                    >
                      {Number(iso.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Button type="button" variant="ghost" className="h-9" onClick={() => onSelect(today)}>
        {t("today")}
      </Button>
    </div>
  );
}
