"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  GripVertical,
  MoveRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  blankItem,
  itemsOf,
  moveItem,
  nudgeItem,
  parseMinutes,
  timingInput,
  type EditorItem,
} from "@/lib/lessons/editor-model";
import type { LessonOptions } from "@/lib/lessons/queries";
import type { LessonGeneralValues } from "@/lib/lessons/schema";
import { computeLessonTiming, formatClockTime, type LessonTiming } from "@/lib/lessons/timing";
import { cn } from "@/lib/utils";
import { ItemDialog } from "./item-dialog";
import { sectionDroppableId, type DragData } from "./lesson-dnd";

type Section = LessonOptions["sections"][number];

export function SectionBoard({
  items,
  options,
  general,
  itemErrorIds,
  updateItems,
}: {
  items: EditorItem[];
  options: LessonOptions;
  general: LessonGeneralValues;
  itemErrorIds: Set<string>;
  updateItems: (fn: (items: EditorItem[]) => EditorItem[]) => void;
}) {
  const t = useTranslations();
  const sectionOrder = options.sections.map((s) => s.id);
  const [editing, setEditing] = useState<string | null>(null);
  const sectionName = (s: Section) => s.name ?? (s.builtin ? t(`sections.${s.builtin}`) : "");

  const startTime = /^\d\d:\d\d$/.test(String(general.startTime))
    ? Number(String(general.startTime).slice(0, 2)) * 60 +
      Number(String(general.startTime).slice(3))
    : null;
  const planned = parseMinutes(general.totalDurationMinutes);
  const timing = computeLessonTiming(
    timingInput(items, sectionOrder, startTime, planned && planned > 0 ? planned : null),
  );
  const editingItem = items.find((i) => i.id === editing) ?? null;

  return (
    <div className="grid gap-6">
      <TimingSummary timing={timing} planned={planned} />

      {options.sections.map((section) => (
        <SectionColumn
          key={section.id}
          section={section}
          title={sectionName(section)}
          items={itemsOf(items, section.id)}
          timing={timing}
          sections={options.sections.map((s) => ({ id: s.id, name: sectionName(s) }))}
          coachName={(id) => options.coaches.find((c) => c.id === id)?.name ?? ""}
          itemErrorIds={itemErrorIds}
          onEdit={setEditing}
          onNudge={(id, dir) => updateItems((list) => nudgeItem(list, sectionOrder, id, dir))}
          onMove={(id, sectionId) =>
            updateItems((list) => moveItem(list, sectionOrder, id, sectionId, null))
          }
          onRemove={(id) => updateItems((list) => list.filter((i) => i.id !== id))}
          onQuickAdd={(title, minutes) =>
            updateItems((list) => [
              ...list,
              blankItem(crypto.randomUUID(), section.id, title, minutes),
            ])
          }
        />
      ))}

      {editingItem ? (
        <ItemDialog
          key={editingItem.id}
          item={editingItem}
          options={options}
          presentCoachIds={general.presentCoachIds}
          onClose={() => setEditing(null)}
          onSave={(updated) =>
            updateItems((list) => list.map((i) => (i.id === updated.id ? updated : i)))
          }
        />
      ) : null}
    </div>
  );
}

function TimingSummary({ timing, planned }: { timing: LessonTiming; planned: number | null }) {
  const t = useTranslations();
  const minutes = (count: number) => t("units.minutes", { count });
  const tone =
    timing.status === "over"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : timing.status === "remaining"
        ? "border-amber-500/40 bg-amber-500/5"
        : timing.status === "exact"
          ? "border-green-600/40 bg-green-600/5"
          : "";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border px-4 py-3",
        tone,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">
        {t("lessons.timing.total", { minutes: minutes(timing.totalMinutes) })}
      </span>
      {planned ? <span>{t("lessons.timing.budget", { minutes: minutes(planned) })}</span> : null}
      {timing.status === "remaining" && timing.differenceMinutes !== null ? (
        <span className="font-semibold">
          {t("lessons.timing.remaining", { minutes: minutes(timing.differenceMinutes) })}
        </span>
      ) : null}
      {timing.status === "over" && timing.differenceMinutes !== null ? (
        <span className="flex items-center gap-1 font-semibold">
          <AlertTriangle aria-hidden className="size-4" />
          {t("lessons.timing.over", { minutes: minutes(-timing.differenceMinutes) })}
        </span>
      ) : null}
      {timing.status === "exact" ? (
        <span className="font-semibold">{t("lessons.timing.exact")}</span>
      ) : null}
      {timing.endTimeMinutes !== null ? (
        <span className="text-muted-foreground">
          {t("lessons.timing.endsAt", { time: formatClockTime(timing.endTimeMinutes) })}
        </span>
      ) : null}
      {timing.itemsWithoutDuration > 0 ? (
        <span className="text-muted-foreground">
          {t("lessons.timing.withoutDuration", { count: timing.itemsWithoutDuration })}
        </span>
      ) : null}
    </div>
  );
}

function SectionColumn({
  section,
  title,
  items,
  timing,
  sections,
  coachName,
  itemErrorIds,
  onEdit,
  onNudge,
  onMove,
  onRemove,
  onQuickAdd,
}: {
  section: Section;
  title: string;
  items: EditorItem[];
  timing: LessonTiming;
  sections: { id: string; name: string }[];
  coachName: (id: string) => string;
  itemErrorIds: Set<string>;
  onEdit: (id: string) => void;
  onNudge: (id: string, direction: -1 | 1) => void;
  onMove: (id: string, sectionId: string) => void;
  onRemove: (id: string) => void;
  onQuickAdd: (title: string, minutes: string) => void;
}) {
  const t = useTranslations();
  const headingId = useId();
  const data: DragData = { type: "section", sectionId: section.id, title };
  const { setNodeRef, isOver } = useDroppable({ id: sectionDroppableId(section.id), data });
  const total = timing.sections[section.id]?.totalMinutes ?? 0;

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2 border-b pb-1">
        <h2 id={headingId} className="text-sm font-semibold tracking-wider uppercase">
          {title}
        </h2>
        <span className="text-muted-foreground text-sm tabular-nums">
          {t("units.minutesShort", { count: total })}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "grid min-h-16 gap-2 rounded-xl p-1 transition-colors",
          isOver && "bg-primary/5 ring-primary/40 ring-2",
        )}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {t("lessons.items.emptySection")}
            </p>
          ) : (
            items.map((item, index) => (
              <ItemCard
                key={item.id}
                item={item}
                index={index}
                count={items.length}
                sectionId={section.id}
                timing={timing}
                sections={sections}
                coachName={coachName}
                hasError={itemErrorIds.has(item.id)}
                onEdit={() => onEdit(item.id)}
                onNudge={(dir) => onNudge(item.id, dir)}
                onMove={(to) => onMove(item.id, to)}
                onRemove={() => onRemove(item.id)}
              />
            ))
          )}
        </SortableContext>
      </div>
      <QuickAdd onAdd={onQuickAdd} />
    </section>
  );
}

function ItemCard({
  item,
  index,
  count,
  sectionId,
  timing,
  sections,
  coachName,
  hasError,
  onEdit,
  onNudge,
  onMove,
  onRemove,
}: {
  item: EditorItem;
  index: number;
  count: number;
  sectionId: string;
  timing: LessonTiming;
  sections: { id: string; name: string }[];
  coachName: (id: string) => string;
  hasError: boolean;
  onEdit: () => void;
  onNudge: (direction: -1 | 1) => void;
  onMove: (sectionId: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const data: DragData = { type: "item", sectionId, title: item.title };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data });
  const clock = timing.items[item.id]?.startTimeMinutes ?? null;
  const minutes = parseMinutes(item.durationMinutes);
  const responsible =
    item.responsible.kind === "coach"
      ? coachName(item.responsible.coachId)
      : item.responsible.kind === "text"
        ? item.responsible.text
        : null;
  const title = item.title || t("lessons.untitled");

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-background flex items-start gap-2 rounded-lg border p-2",
        isDragging && "opacity-40",
        hasError && "border-destructive",
      )}
      aria-label={title}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t("lessons.items.dragHandle", { name: title })}
        className="text-muted-foreground hover:bg-accent focus-visible:ring-ring/50 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md outline-none focus-visible:ring-3"
      >
        <GripVertical aria-hidden className="size-5" />
      </button>
      <div className="w-14 shrink-0 pt-2 text-sm tabular-nums">
        {clock !== null ? <div className="font-medium">{formatClockTime(clock)}</div> : null}
        {minutes !== null ? (
          <div className="text-muted-foreground">{t("units.minutesShort", { count: minutes })}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="hover:bg-accent focus-visible:ring-ring/50 grid min-h-11 min-w-0 flex-1 content-start gap-1 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-3"
      >
        <span className="font-medium">{title}</span>
        <span className="flex flex-wrap items-center gap-1 text-sm">
          {responsible ? (
            <span className="text-muted-foreground">
              {t("lessons.items.responsible", { name: responsible })}
            </span>
          ) : null}
          {item.modifiedLocally ? (
            <Badge variant="outline">{t("lessons.items.modified")}</Badge>
          ) : null}
          {!item.sourceBlockId ? (
            <Badge variant="outline">{t("lessons.items.oneOff")}</Badge>
          ) : null}
          {hasError ? (
            <Badge variant="destructive">
              <AlertTriangle aria-hidden />
              {t("lessons.save.failed")}
            </Badge>
          ) : null}
        </span>
      </button>
      <div
        className="flex shrink-0 flex-wrap items-center justify-end"
        role="group"
        aria-label={t("lessons.items.actions", { name: title })}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          disabled={index === 0}
          aria-label={`${title}: ${t("common.moveUp")}`}
          onClick={() => onNudge(-1)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          disabled={index === count - 1}
          aria-label={`${title}: ${t("common.moveDown")}`}
          onClick={() => onNudge(1)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={`${title}: ${t("lessons.items.moveTo")}`}
            >
              <MoveRight aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("lessons.items.moveTo")}</DropdownMenuLabel>
            {sections
              .filter((s) => s.id !== sectionId)
              .map((s) => (
                <DropdownMenuItem key={s.id} className="min-h-10" onSelect={() => onMove(s.id)}>
                  {s.name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`${title}: ${t("lessons.items.edit")}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={`${title}: ${t("lessons.items.remove")}`}
            >
              <Trash2 aria-hidden />
            </Button>
          }
          description={t("lessons.items.removeConfirm", { name: title })}
          confirmLabel={t("lessons.items.remove")}
          onConfirm={onRemove}
        />
      </div>
    </article>
  );
}

function QuickAdd({ onAdd }: { onAdd: (title: string, minutes: string) => void }) {
  const t = useTranslations("lessons.items");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), minutes);
    setTitle("");
    setMinutes("");
  }

  if (!open) {
    return (
      <Button variant="ghost" className="h-11 justify-self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t("quickAdd")}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="grid min-w-56 flex-1 gap-1 text-sm font-medium">
        {t("quickAddTitle")}
        <Input
          autoFocus
          value={title}
          maxLength={150}
          placeholder={t("quickAddPlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 text-base"
        />
      </label>
      <label className="grid w-24 gap-1 text-sm font-medium">
        {t("quickAddDuration")}
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={600}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="h-11 text-base"
        />
      </label>
      <Button type="submit" className="h-11">
        <Plus aria-hidden />
        {t("quickAdd")}
      </Button>
    </form>
  );
}
