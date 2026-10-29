"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionErrorMessage } from "@/lib/i18n-keys";
import type { EditorItem } from "@/lib/lessons/editor-model";
import type { LessonOptions } from "@/lib/lessons/queries";
import { cn } from "@/lib/utils";
import { blockSnapshotAction, searchLibraryAction } from "../actions";
import { itemFromSnapshot } from "./item-from-snapshot";
import { libraryDraggableId, type DragData } from "./lesson-dnd";

type Result = { id: string; title: string; durationMinutes: number | null; tags: string[] };
const SUGGESTED = "suggested";

export function LibraryPanel({
  options,
  lessonTeamId,
  draggable,
  onAdd,
}: {
  options: LessonOptions;
  lessonTeamId: string | null;
  draggable: boolean;
  onAdd: (item: EditorItem) => void;
}) {
  const t = useTranslations();
  const ids = { search: useId(), insert: useId(), durMax: useId(), kids: useId(), all: useId() };
  const [q, setQ] = useState("");
  const [durMax, setDurMax] = useState("");
  const [kids, setKids] = useState("");
  const [allTeams, setAllTeams] = useState(false);
  const [insertInto, setInsertInto] = useState(SUGGESTED);
  const [results, setResults] = useState<Result[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const sectionName = (s: LessonOptions["sections"][number]) =>
    s.name ?? (s.builtin ? t(`sections.${s.builtin}`) : "");

  // Debounced search; numbers outside the allowed range are simply not sent.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const num = (v: string, max: number) => {
        const n = Number(v);
        return v && Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
      };
      const result = await searchLibraryAction({
        q: q.trim().slice(0, 100) || undefined,
        teamId: allTeams ? null : lessonTeamId,
        durMax: num(durMax, 600),
        kids: num(kids, 500),
        page,
      });
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) return void toast.error(actionErrorMessage(t, result));
      setPageCount(result.data.pageCount);
      setResults((prev) => (page === 1 ? result.data.items : [...prev, ...result.data.items]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, durMax, kids, allTeams, lessonTeamId, page, t]);

  async function add(block: Result) {
    const result = await blockSnapshotAction({ blockId: block.id });
    if (!result.ok) return void toast.error(actionErrorMessage(t, result));
    const sectionId =
      insertInto === SUGGESTED
        ? (result.data.suggestedSectionId ?? options.sections[0]?.id)
        : insertInto;
    if (!sectionId) return;
    onAdd(itemFromSnapshot(result.data, sectionId));
    toast.success(t("lessons.library.added", { name: block.title }));
  }

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  return (
    <div className="grid gap-4">
      <div className="relative">
        <label htmlFor={ids.search} className="sr-only">
          {t("lessons.library.search")}
        </label>
        <Search
          aria-hidden
          className="text-muted-foreground absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <Input
          id={ids.search}
          type="search"
          value={q}
          maxLength={100}
          placeholder={t("blocks.searchPlaceholder")}
          onChange={(e) => resetPage(setQ)(e.target.value)}
          className="h-11 pl-10 text-base"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={ids.durMax} className="grid gap-1 text-sm font-medium">
          {t("blocks.durationRange")} {t("common.to")}
          <Input
            id={ids.durMax}
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            value={durMax}
            onChange={(e) => resetPage(setDurMax)(e.target.value)}
            className="h-11 text-base"
          />
        </label>
        <label htmlFor={ids.kids} className="grid gap-1 text-sm font-medium">
          {t("blocks.filterKids")}
          <Input
            id={ids.kids}
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={kids}
            onChange={(e) => resetPage(setKids)(e.target.value)}
            className="h-11 text-base"
          />
        </label>
      </div>
      {lessonTeamId ? (
        <Label htmlFor={ids.all} className="flex min-h-11 items-center gap-3 font-normal">
          <Checkbox
            id={ids.all}
            checked={allTeams}
            onCheckedChange={(v) => resetPage(setAllTeams)(v === true)}
          />
          {t("lessons.library.allTeams")}
        </Label>
      ) : null}
      <label htmlFor={ids.insert} className="grid gap-1 text-sm font-medium">
        {t("lessons.library.insertInto")}
        <select
          id={ids.insert}
          value={insertInto}
          onChange={(e) => setInsertInto(e.target.value)}
          className="border-input bg-background focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-base outline-none focus-visible:ring-3"
        >
          <option value={SUGGESTED}>{t("lessons.library.suggested")}</option>
          {options.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {sectionName(s)}
            </option>
          ))}
        </select>
      </label>
      {draggable ? (
        <p className="text-muted-foreground text-sm">{t("lessons.library.dragHint")}</p>
      ) : null}

      <ul className="grid gap-2" aria-busy={loading}>
        {results.map((block) => (
          <LibraryResult
            key={block.id}
            block={block}
            draggable={draggable}
            onAdd={() => void add(block)}
          />
        ))}
      </ul>
      {!loading && results.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("lessons.library.empty")}</p>
      ) : null}
      {page < pageCount ? (
        <Button
          variant="outline"
          className="h-11"
          disabled={loading}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("lessons.library.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

function LibraryResult({
  block,
  draggable,
  onAdd,
}: {
  block: Result;
  draggable: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations();
  const data: DragData = { type: "library", blockId: block.id, title: block.title };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: libraryDraggableId(block.id),
    data,
    disabled: !draggable,
  });
  return (
    <li
      ref={setNodeRef}
      className={cn("flex items-center gap-1 rounded-lg border p-1", isDragging && "opacity-40")}
    >
      {draggable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t("lessons.items.dragHandle", { name: block.title })}
          className="text-muted-foreground hover:bg-accent focus-visible:ring-ring/50 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md outline-none focus-visible:ring-3"
        >
          <GripVertical aria-hidden className="size-5" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1 px-1">
        <p className="truncate font-medium">{block.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {[
            block.durationMinutes !== null
              ? t("units.minutesShort", { count: block.durationMinutes })
              : null,
            ...block.tags,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        aria-label={t("lessons.library.addNamed", { name: block.title })}
        onClick={onAdd}
      >
        <Plus aria-hidden />
      </Button>
    </li>
  );
}
