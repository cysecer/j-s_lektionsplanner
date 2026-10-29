"use client";

import { useTranslations } from "next-intl";
import type { Responsible } from "@/lib/blocks/schema";
import type { LessonOptions } from "@/lib/lessons/queries";
import { cn } from "@/lib/utils";

/**
 * Picks who leads a program item: a present coach first, then the others,
 * or free text. Used inline on the item cards and in the item dialog.
 */
export function ResponsibleSelect({
  id,
  value,
  onChange,
  coaches,
  presentCoachIds,
  className,
  ...aria
}: {
  id?: string;
  value: Responsible;
  onChange: (value: Responsible) => void;
  coaches: LessonOptions["coaches"];
  presentCoachIds: string[];
  className?: string;
  "aria-label"?: string;
}) {
  const t = useTranslations("lessons.itemDialog");
  const present = coaches.filter((c) => presentCoachIds.includes(c.id));
  const others = coaches.filter((c) => !presentCoachIds.includes(c.id));
  const selected = value.kind === "coach" ? `coach:${value.coachId}` : value.kind;

  return (
    <select
      id={id}
      {...aria}
      value={selected}
      onChange={(e) => {
        const v = e.target.value;
        onChange(
          v === "none"
            ? { kind: "none" }
            : v === "text"
              ? { kind: "text", text: value.kind === "text" ? value.text : "" }
              : { kind: "coach", coachId: v.slice("coach:".length) },
        );
      }}
      className={cn(
        "border-input bg-background focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-base outline-none focus-visible:ring-3",
        className,
      )}
    >
      <option value="none">{t("responsibleNone")}</option>
      {present.length > 0 ? (
        <optgroup label={t("presentGroup")}>
          {present.map((c) => (
            <option key={c.id} value={`coach:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {others.length > 0 ? (
        <optgroup label={t("otherGroup")}>
          {others.map((c) => (
            <option key={c.id} value={`coach:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      <option value="text">{t("freeText")}</option>
    </select>
  );
}
