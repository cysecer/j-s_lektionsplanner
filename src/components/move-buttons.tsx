"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Keyboard- and touch-friendly reordering: one step up or down. */
export function MoveButtons({
  index,
  count,
  disabled,
  label,
  onMove,
}: {
  index: number;
  count: number;
  disabled?: boolean;
  /** Item name, so screen readers announce "Kids nach oben". */
  label: string;
  onMove: (from: number, to: number) => void;
}) {
  const t = useTranslations("common");
  return (
    <div className="flex">
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        disabled={disabled || index === 0}
        aria-label={`${label}: ${t("moveUp")}`}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        disabled={disabled || index === count - 1}
        aria-label={`${label}: ${t("moveDown")}`}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown aria-hidden />
      </Button>
    </div>
  );
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
