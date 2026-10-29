"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { MoveButtons, moveItem } from "@/components/move-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Editable list of short texts (variations, material, list fields). */
export function ListEditor({
  items,
  onChange,
  labelledBy,
  max,
  maxLength,
  errors,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  labelledBy: string;
  max: number;
  maxLength: number;
  /** Error message per index, e.g. from server validation. */
  errors?: Record<number, string>;
}) {
  const t = useTranslations("listEditor");
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value || items.length >= max) return;
    onChange([...items, value]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  }

  return (
    <div className="grid gap-2" role="group" aria-labelledby={labelledBy}>
      {items.length > 0 ? (
        <ol className="grid gap-2">
          {items.map((item, index) => (
            <li key={index} className="grid gap-1">
              <div className="flex items-center gap-1">
                <Input
                  className="h-11 flex-1 text-base"
                  value={item}
                  maxLength={maxLength}
                  aria-labelledby={labelledBy}
                  aria-invalid={errors?.[index] ? true : undefined}
                  onChange={(e) =>
                    onChange(items.map((x, i) => (i === index ? e.target.value : x)))
                  }
                />
                <MoveButtons
                  index={index}
                  count={items.length}
                  label={item}
                  onMove={(from, to) => onChange(moveItem(items, from, to))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={t("remove", { item })}
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                >
                  <X aria-hidden />
                </Button>
              </div>
              {errors?.[index] ? (
                <p className="text-destructive text-sm" role="alert">
                  {errors[index]}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {items.length < max ? (
        <div className="flex gap-1">
          <Input
            className="h-11 flex-1 text-base"
            value={draft}
            maxLength={maxLength}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={add}
          />
          <Button type="button" variant="outline" className="h-11" onClick={add}>
            <Plus aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("add")}</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
