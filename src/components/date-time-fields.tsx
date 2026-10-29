"use client";

import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import { Calendar } from "@/components/calendar";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FORMAT_LOCALE, type Locale } from "@/i18n/config";
import { formatDateInput, normalizeTime, parseDateInput, weekdayShort } from "@/lib/date-input";
import { cn } from "@/lib/utils";

type Common = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  wrapperClassName?: string;
};

/** Commits on blur and Enter, so autosave never sees a half-typed value. */
function commitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur();
}

/**
 * Time of day, always HH:MM (24 h) regardless of the device's locale.
 * Typing "18" or "1730" becomes "18:00" / "17:30" on leaving the field.
 */
export function TimeField({
  value,
  onChange,
  ...common
}: Common & { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("common");
  const [text, setText] = useState(value);
  // Follow the value when the form resets it (adjust state on prop change).
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setText(value);
  }
  return (
    <FormField
      {...common}
      value={text}
      inputMode="numeric"
      autoComplete="off"
      placeholder={t("timePlaceholder")}
      maxLength={5}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={commitOnEnter}
      onBlur={() => {
        const next = normalizeTime(text);
        setText(next);
        if (next !== value) onChange(next);
      }}
    />
  );
}

/**
 * Calendar date as dd.MM.yyyy with the weekday in front ("Mi 28.11.2018").
 * `value` is ISO (yyyy-mm-dd); text that is no valid date is passed on
 * unchanged so the form's validation can report it. The calendar button
 * opens a month calendar with weeks starting on Monday. With `name`, a hidden input carries the
 * ISO value for plain GET forms.
 */
export function DateField({
  value,
  onChange,
  name,
  ...common
}: Common & { value: string; onChange?: (value: string) => void; name?: string }) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(formatDateInput(value));
  const [iso, setIso] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setText(formatDateInput(value));
    setIso(value);
  }

  const valid = parseDateInput(text, new Date().getFullYear());
  const weekday = valid ? weekdayShort(valid, FORMAT_LOCALE[locale]) : "";

  function commit(next: string) {
    const parsed = parseDateInput(next, new Date().getFullYear());
    const result = next.trim() === "" ? "" : (parsed ?? next);
    setText(parsed ? formatDateInput(parsed) : next);
    setIso(result);
    if (result !== value) onChange?.(result);
  }

  const describedBy = [
    weekday ? `${id}-weekday` : null,
    common.error ? `${id}-error` : common.hint ? `${id}-hint` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid gap-2", common.wrapperClassName)}>
      <Label htmlFor={id}>{common.label}</Label>
      <div className="relative">
        <span
          id={`${id}-weekday`}
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 w-8 -translate-y-1/2 text-base"
        >
          {weekday}
        </span>
        <Input
          id={id}
          className="h-11 pr-12 pl-12 text-base tabular-nums"
          value={text}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t("datePlaceholder")}
          maxLength={10}
          required={common.required}
          aria-invalid={common.error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={commitOnEnter}
          onBlur={() => commit(text)}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 size-11"
              aria-label={t("openCalendar")}
            >
              <CalendarDays aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent aria-label={t("calendar")}>
            <Calendar
              value={valid}
              formatLocale={FORMAT_LOCALE[locale]}
              onSelect={(day) => {
                commit(day);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {common.error ? (
        <p id={`${id}-error`} className="text-destructive text-sm" role="alert">
          {common.error}
        </p>
      ) : common.hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {common.hint}
        </p>
      ) : null}
      {name ? <input type="hidden" name={name} value={iso} /> : null}
    </div>
  );
}
