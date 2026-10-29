"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { LessonDocumentView } from "@/components/lesson-document/lesson-document";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { describeFieldErrors, firstFieldError } from "@/lib/i18n-keys";
import {
  addColumn,
  availableFields,
  columnOf,
  hiddenFields,
  moveColumn,
  moveField,
  nudgeField,
  nudgeInList,
  removeColumn,
  setShowLabel,
  updateColumn,
} from "@/lib/layout/editor-model";
import {
  CONDITION_FIELDS,
  LAYOUT_MAX_COLUMNS,
  LAYOUT_MAX_WIDTH,
  layoutConfigSchema,
  NOTE_BOXES,
  TEXT_SIZES,
  type LayoutColumn,
  type LayoutConfig,
  type LayoutFieldRef,
} from "@/lib/layout/schema";
import type { DocumentClub, LessonDocument } from "@/lib/lessons/document";
import { toFieldErrors, type FieldErrors } from "@/lib/server/result";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import { saveLayoutAction } from "../actions";

const HIDDEN = "hidden";
const containerId = (columnId: string | null) => `container:${columnId ?? HIDDEN}`;
const selectClass =
  "border-input bg-background focus-visible:ring-ring/50 h-10 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3";

type DragData =
  { type: "field"; field: LayoutFieldRef } | { type: "container"; columnId: string | null };

export function LayoutEditor({
  layoutId,
  initialName,
  initialConfig,
  customFields,
  preview,
  previewIsSample,
  club,
}: {
  layoutId: string;
  initialName: string;
  initialConfig: LayoutConfig;
  customFields: { id: string; label: string }[];
  preview: LessonDocument;
  previewIsSample: boolean;
  club: DocumentClub;
}) {
  const t = useTranslations();
  const [name, setName] = useState(initialName);
  const [config, setConfig] = useState(initialConfig);
  const [dirty, setDirty] = useState(false);
  const [localErrors, setLocalErrors] = useState<FieldErrors>();
  const [dragging, setDragging] = useState<LayoutFieldRef | null>(null);
  const save = useAction(saveLayoutAction);

  const available = availableFields(customFields.map((f) => f.id));
  const hidden = hiddenFields(config, available);
  const fieldName = (field: LayoutFieldRef) =>
    field.startsWith("custom:")
      ? (customFields.find((f) => `custom:${f.id}` === field)?.label ?? field)
      : t(`blockFields.${field as "title"}`);
  const columnName = (c: LayoutColumn) =>
    c.label ?? (c.labelKey ? t(`document.columns.${c.labelKey}`) : "");

  const change = (next: LayoutConfig) => {
    setConfig(next);
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const labels = Object.fromEntries(
    config.columns.flatMap((c, i) => [
      [`config.columns.${i}.label`, `${t("settings.layout.columnLabel")} ${i + 1}`],
      [`columns.${i}.label`, `${t("settings.layout.columnLabel")} ${i + 1}`],
    ]),
  );
  const errors = localErrors ?? save.fieldErrors;
  const columnError = (index: number) =>
    firstFieldError(t, errors, `config.columns.${index}.label`) ??
    firstFieldError(t, errors, `columns.${index}.label`);

  async function submit() {
    const parsed = layoutConfigSchema.safeParse(config);
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setLocalErrors(fieldErrors);
      return;
    }
    setLocalErrors(undefined);
    const ok = await save.run(
      { id: layoutId, name, config: parsed.data },
      {
        success: t("settings.layout.saved"),
        labels: { name: t("settings.layout.name"), ...labels },
      },
    );
    if (ok !== undefined) setDirty(false);
  }

  // Drag & drop of fields between columns and the hidden pool.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dataOf = (data: unknown) => (data as { current?: DragData } | undefined)?.current ?? null;
  const targetOf = (data: DragData | null) =>
    !data
      ? undefined
      : data.type === "container"
        ? { columnId: data.columnId, before: null }
        : { columnId: columnOf(config, data.field), before: data.field };

  function onDragOver(event: DragOverEvent) {
    const active = dataOf(event.active.data);
    const target = targetOf(dataOf(event.over?.data));
    if (active?.type !== "field" || !target) return;
    // Live move across containers; the order inside one is settled on drop.
    if (columnOf(config, active.field) !== target.columnId) {
      change(moveField(config, active.field, target.columnId, target.before));
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const active = dataOf(event.active.data);
    const target = targetOf(dataOf(event.over?.data));
    if (active?.type !== "field" || !target || target.before === active.field) return;
    const column = config.columns.find((c) => c.id === target.columnId);
    if (!column) return;
    const order = column.fields.map((f) => f.field);
    const from = order.indexOf(active.field);
    const to = target.before ? order.indexOf(target.before) : order.length;
    // Dropping onto a field below means "after it".
    const before = from >= 0 && from < to ? (order[to + 1] ?? null) : target.before;
    change(moveField(config, active.field, target.columnId, before));
  }

  const title = (data: unknown) => {
    const d = dataOf(data);
    if (!d) return "";
    if (d.type === "field") return fieldName(d.field);
    const column = config.columns.find((c) => c.id === d.columnId);
    return column ? columnName(column) : t("settings.layout.hidden");
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("lessons.dnd.picked", { name: title(active.data) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("lessons.dnd.over", { name: title(active.data), target: title(over.data) })
        : t("lessons.dnd.overNothing", { name: title(active.data) }),
    onDragEnd: ({ active }) => t("lessons.dnd.dropped", { name: title(active.data) }),
    onDragCancel: () => t("lessons.dnd.cancelled"),
  };

  const moveTargets = [
    ...config.columns.map((c, i) => ({ id: c.id, name: columnName(c) || `${i + 1}` })),
    { id: HIDDEN, name: t("settings.layout.hidden") },
  ];

  return (
    <div data-wide-page className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="-ml-3 h-11">
          <Link href="/settings/layout">
            <ArrowLeft aria-hidden />
            {t("settings.layout.back")}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground text-sm" role="status">
            {dirty ? t("settings.layout.unsaved") : null}
          </p>
          <Button className="h-11" disabled={save.pending || !dirty} onClick={() => void submit()}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      {errors ? (
        <ul className="text-destructive list-disc pl-5 text-sm" role="alert">
          {describeFieldErrors(t, errors, { name: t("settings.layout.name"), ...labels }).map(
            (line) => (
              <li key={line}>{line}</li>
            ),
          )}
        </ul>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="grid min-w-0 gap-6">
          <FormField
            label={t("settings.layout.name")}
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            className="h-11"
            error={firstFieldError(t, errors, "name")}
          />

          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="text-lg">{t("settings.layout.columnsTitle")}</h2>
              </CardTitle>
              <p className="text-muted-foreground text-sm">{t("settings.layout.columnsIntro")}</p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={(e) => {
                  const d = dataOf(e.active.data);
                  setDragging(d?.type === "field" ? d.field : null);
                }}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDragCancel={() => setDragging(null)}
                accessibility={{
                  announcements,
                  screenReaderInstructions: { draggable: t("lessons.dnd.instructions") },
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {config.columns.map((column, index) => (
                    <ColumnCard
                      key={column.id}
                      column={column}
                      index={index}
                      count={config.columns.length}
                      name={columnName(column)}
                      error={columnError(index)}
                      fieldName={fieldName}
                      moveTargets={moveTargets}
                      onChange={(patch) => change(updateColumn(config, column.id, patch))}
                      onMove={(dir) => change(moveColumn(config, column.id, dir))}
                      onRemove={() => change(removeColumn(config, column.id))}
                      onNudgeField={(field, dir) => change(nudgeField(config, field, dir))}
                      onShowLabel={(field, show) => change(setShowLabel(config, field, show))}
                      onMoveField={(field, to) =>
                        change(moveField(config, field, to === HIDDEN ? null : to, null))
                      }
                    />
                  ))}
                </div>
                <HiddenPool
                  fields={hidden}
                  fieldName={fieldName}
                  moveTargets={moveTargets.filter((m) => m.id !== HIDDEN)}
                  onMoveField={(field, to) => change(moveField(config, field, to, null))}
                />
                <DragOverlay>
                  {dragging ? (
                    <div className="bg-background flex items-center gap-2 rounded-lg border p-2 shadow-lg">
                      <GripVertical aria-hidden className="text-muted-foreground size-4" />
                      <span className="text-sm font-medium">{fieldName(dragging)}</span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              <Button
                variant="outline"
                className="h-11 justify-self-start"
                disabled={config.columns.length >= LAYOUT_MAX_COLUMNS}
                onClick={() =>
                  change(
                    addColumn(
                      config,
                      `c${Date.now().toString(36)}`,
                      t("settings.layout.newColumn"),
                    ),
                  )
                }
              >
                <Plus aria-hidden />
                {t("settings.layout.addColumn")}
              </Button>
            </CardContent>
          </Card>

          <DocumentSettings config={config} onChange={change} />
        </div>

        <section
          aria-labelledby="layout-preview"
          className="grid gap-2 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
        >
          <h2 id="layout-preview" className="text-lg font-semibold">
            {t("settings.layout.preview")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {previewIsSample
              ? t("settings.layout.previewEmpty")
              : t("settings.layout.previewWith", { title: preview.title })}
          </p>
          <div className="overflow-x-auto rounded-lg border bg-white p-6 shadow-sm">
            <LessonDocumentView
              document={preview}
              layout={config}
              club={club}
              className="min-w-[36rem]"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ColumnCard({
  column,
  index,
  count,
  name,
  error,
  fieldName,
  moveTargets,
  onChange,
  onMove,
  onRemove,
  onNudgeField,
  onShowLabel,
  onMoveField,
}: {
  column: LayoutColumn;
  index: number;
  count: number;
  name: string;
  error: string | undefined;
  fieldName: (field: LayoutFieldRef) => string;
  moveTargets: { id: string; name: string }[];
  onChange: (patch: Partial<Pick<LayoutColumn, "label" | "width">>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onNudgeField: (field: LayoutFieldRef, direction: -1 | 1) => void;
  onShowLabel: (field: LayoutFieldRef, show: boolean) => void;
  onMoveField: (field: LayoutFieldRef, to: string) => void;
}) {
  const t = useTranslations();
  const widthId = useId();
  const data: DragData = { type: "container", columnId: column.id };
  const { setNodeRef, isOver } = useDroppable({ id: containerId(column.id), data });
  const placeholder = column.labelKey ? t(`document.columns.${column.labelKey}`) : undefined;
  const display = name || `${t("settings.layout.columnLabel")} ${index + 1}`;

  return (
    <section
      ref={setNodeRef}
      aria-label={display}
      className={cn(
        "grid content-start gap-3 rounded-lg border p-3 transition-colors",
        isOver && "bg-primary/5 ring-primary/50 ring-2",
      )}
    >
      <FormField
        label={`${t("settings.layout.columnLabel")} ${index + 1}`}
        value={column.label ?? ""}
        placeholder={placeholder}
        maxLength={60}
        onChange={(e) =>
          onChange({ label: e.target.value === "" && column.labelKey ? null : e.target.value })
        }
        className="h-10"
        error={error}
        hint={placeholder ? t("settings.layout.columnLabelHint") : undefined}
      />
      <div className="flex flex-wrap items-end gap-2">
        <label htmlFor={widthId} className="grid gap-1 text-sm font-medium">
          {t("settings.layout.width")}
          <select
            id={widthId}
            value={column.width}
            onChange={(e) => onChange({ width: Number(e.target.value) })}
            className={selectClass}
          >
            {Array.from({ length: LAYOUT_MAX_WIDTH }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            disabled={index === 0}
            aria-label={`${display}: ${t("settings.layout.moveLeft")}`}
            onClick={() => onMove(-1)}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            disabled={index === count - 1}
            aria-label={`${display}: ${t("settings.layout.moveRight")}`}
            onClick={() => onMove(1)}
          >
            <ArrowRight aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            disabled={count <= 1}
            aria-label={`${display}: ${t("settings.layout.removeColumn")}`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      <SortableContext
        items={column.fields.map((f) => f.field)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="grid min-h-12 gap-2">
          {column.fields.length === 0 ? (
            <li className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              {t("settings.layout.emptyColumn")}
            </li>
          ) : (
            column.fields.map((f, fi) => (
              <FieldChip
                key={f.field}
                field={f.field}
                name={fieldName(f.field)}
                showLabel={f.showLabel}
                first={fi === 0}
                last={fi === column.fields.length - 1}
                currentTarget={column.id}
                moveTargets={moveTargets}
                onNudge={(dir) => onNudgeField(f.field, dir)}
                onShowLabel={(show) => onShowLabel(f.field, show)}
                onMove={(to) => onMoveField(f.field, to)}
              />
            ))
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

function FieldChip({
  field,
  name,
  showLabel,
  first,
  last,
  currentTarget,
  moveTargets,
  onNudge,
  onShowLabel,
  onMove,
}: {
  field: LayoutFieldRef;
  name: string;
  showLabel?: boolean;
  first?: boolean;
  last?: boolean;
  currentTarget: string;
  moveTargets: { id: string; name: string }[];
  onNudge?: (direction: -1 | 1) => void;
  onShowLabel?: (show: boolean) => void;
  onMove: (to: string) => void;
}) {
  const t = useTranslations();
  const labelId = useId();
  const data: DragData = { type: "field", field };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field, data });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("bg-background grid gap-1 rounded-md border p-1", isDragging && "opacity-40")}
      aria-label={name}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t("lessons.items.dragHandle", { name })}
          className="text-muted-foreground hover:bg-accent focus-visible:ring-ring/50 flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-md outline-none focus-visible:ring-3"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
        <span className="min-w-0 flex-1 text-sm font-medium break-words">{name}</span>
        {onNudge ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              disabled={first}
              aria-label={`${name}: ${t("common.moveUp")}`}
              onClick={() => onNudge(-1)}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              disabled={last}
              aria-label={`${name}: ${t("common.moveDown")}`}
              onClick={() => onNudge(1)}
            >
              <ArrowDown aria-hidden />
            </Button>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
        {onShowLabel ? (
          <Label htmlFor={labelId} className="flex min-h-10 items-center gap-2 text-sm font-normal">
            <Checkbox
              id={labelId}
              checked={showLabel}
              onCheckedChange={(v) => onShowLabel(v === true)}
            />
            {t("settings.layout.showLabel")}
          </Label>
        ) : null}
        <select
          aria-label={`${name}: ${t("settings.layout.moveTo")}`}
          value={currentTarget}
          onChange={(e) => onMove(e.target.value)}
          className={cn(selectClass, "ml-auto max-w-full")}
        >
          {currentTarget === HIDDEN ? (
            <option value={HIDDEN} disabled>
              {t("settings.layout.addTo")}
            </option>
          ) : null}
          {moveTargets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === HIDDEN ? m.name : `→ ${m.name}`}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

function HiddenPool({
  fields,
  fieldName,
  moveTargets,
  onMoveField,
}: {
  fields: LayoutFieldRef[];
  fieldName: (field: LayoutFieldRef) => string;
  moveTargets: { id: string; name: string }[];
  onMoveField: (field: LayoutFieldRef, to: string) => void;
}) {
  const t = useTranslations();
  const data: DragData = { type: "container", columnId: null };
  const { setNodeRef, isOver } = useDroppable({ id: containerId(null), data });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby="layout-hidden"
      className={cn(
        "bg-muted/40 grid gap-2 rounded-lg border border-dashed p-3 transition-colors",
        isOver && "bg-primary/5 ring-primary/50 ring-2",
      )}
    >
      <h3 id="layout-hidden" className="flex items-center gap-2 text-sm font-semibold">
        <EyeOff aria-hidden className="size-4" />
        {t("settings.layout.hidden")}
      </h3>
      <SortableContext items={fields} strategy={verticalListSortingStrategy}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {fields.length === 0 ? (
            <li className="text-muted-foreground text-sm">{t("settings.layout.noneHidden")}</li>
          ) : (
            fields.map((field) => (
              <FieldChip
                key={field}
                field={field}
                name={fieldName(field)}
                currentTarget={HIDDEN}
                moveTargets={moveTargets}
                onMove={(to) => onMoveField(field, to)}
              />
            ))
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

function DocumentSettings({
  config,
  onChange,
}: {
  config: LayoutConfig;
  onChange: (config: LayoutConfig) => void;
}) {
  const t = useTranslations();
  const ids = { logo: useId(), size: useId() };
  const doc = config.document;
  const set = (patch: Partial<LayoutConfig["document"]>) =>
    onChange({ ...config, document: { ...doc, ...patch } });
  const disabledConditions = CONDITION_FIELDS.filter((c) => !doc.conditions.includes(c));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">{t("settings.layout.documentTitle")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap items-end gap-6">
          <Label htmlFor={ids.logo} className="flex min-h-11 items-center gap-3 font-normal">
            <Checkbox
              id={ids.logo}
              checked={doc.showLogo}
              onCheckedChange={(v) => set({ showLogo: v === true })}
            />
            {t("settings.layout.showLogo")}
          </Label>
          <label htmlFor={ids.size} className="grid gap-1 text-sm font-medium">
            {t("settings.layout.textSize")}
            <select
              id={ids.size}
              value={doc.textSize}
              onChange={(e) => set({ textSize: e.target.value as (typeof TEXT_SIZES)[number] })}
              className={cn(selectClass, "h-11 text-base")}
            >
              {TEXT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {t(`settings.layout.textSizes.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 font-medium">{t("document.conditions")}</legend>
          <p className="text-muted-foreground text-sm">{t("settings.layout.conditionsHint")}</p>
          <ul className="divide-y rounded-lg border">
            {[...doc.conditions, ...disabledConditions].map((field) => {
              const enabled = doc.conditions.includes(field);
              const index = doc.conditions.indexOf(field);
              const label = t(`document.conditionLabels.${field}`);
              return (
                <li key={field} className="flex items-center gap-2 px-3 py-1">
                  <Label className="flex min-h-10 flex-1 items-center gap-3 font-normal">
                    <Checkbox
                      checked={enabled}
                      onCheckedChange={(v) =>
                        set({
                          conditions:
                            v === true
                              ? [...doc.conditions, field]
                              : doc.conditions.filter((c) => c !== field),
                        })
                      }
                    />
                    <span className={enabled ? undefined : "text-muted-foreground"}>{label}</span>
                  </Label>
                  {enabled ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10"
                        disabled={index === 0}
                        aria-label={`${label}: ${t("common.moveUp")}`}
                        onClick={() => set({ conditions: nudgeInList(doc.conditions, field, -1) })}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10"
                        disabled={index === doc.conditions.length - 1}
                        aria-label={`${label}: ${t("common.moveDown")}`}
                        onClick={() => set({ conditions: nudgeInList(doc.conditions, field, 1) })}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset className="grid gap-1">
          <legend className="mb-1 font-medium">{t("settings.layout.boxes")}</legend>
          {NOTE_BOXES.map((box) => (
            <Label key={box} className="flex min-h-10 items-center gap-3 font-normal">
              <Checkbox
                checked={doc.boxes.includes(box)}
                onCheckedChange={(v) =>
                  set({
                    boxes: NOTE_BOXES.filter((b) =>
                      b === box ? v === true : doc.boxes.includes(b),
                    ),
                  })
                }
              />
              {t(`document.boxes.${box}`)}
            </Label>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}
