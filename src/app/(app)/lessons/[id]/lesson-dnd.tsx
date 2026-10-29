"use client";

import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/i18n-keys";
import { insertItem, itemsOf, moveItem, type EditorItem } from "@/lib/lessons/editor-model";
import { blockSnapshotAction } from "../actions";
import { itemFromSnapshot } from "./item-from-snapshot";

/** Data attached to draggables/droppables so handlers know what they deal with. */
export type DragData =
  | { type: "item"; sectionId: string; title: string }
  | { type: "section"; sectionId: string; title: string }
  | { type: "library"; blockId: string; title: string };

/**
 * Items snap to the nearest place (comfortable reordering). Library blocks
 * only land where the pointer actually is, so letting go over the library
 * panel (or anywhere outside a section) cancels instead of inserting.
 */
const collisionDetection: CollisionDetection = (args) =>
  (args.active.data.current as DragData | undefined)?.type === "library" && args.pointerCoordinates // keyboard drags have none: fall back to the nearest section
    ? pointerWithin(args)
    : closestCorners(args);

export const sectionDroppableId = (sectionId: string) => `section:${sectionId}`;

const DropSectionContext = createContext<string | null>(null);

/** Section a dragged block would land in right now (null when not dragging). */
export const useDropSection = () => useContext(DropSectionContext);
export const libraryDraggableId = (blockId: string) => `library:${blockId}`;

/**
 * Drag & drop for the lesson editor: reorder items, move them between
 * sections, and drag blocks in from the library. Works with mouse, touch
 * (long press) and keyboard (space to pick up, arrows to move).
 */
export function LessonDnd({
  items,
  sectionOrder,
  updateItems,
  children,
}: {
  items: EditorItem[];
  sectionOrder: string[];
  updateItems: (fn: (items: EditorItem[]) => EditorItem[]) => void;
  children: ReactNode;
}) {
  const t = useTranslations();
  const [active, setActive] = useState<DragData | null>(null);
  const [dropSection, setDropSection] = useState<string | null>(null);
  const latest = useRef(items);
  useEffect(() => {
    latest.current = items;
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dataOf = (data: unknown) => (data as { current?: DragData } | undefined)?.current ?? null;

  /** Section and "insert before" item for the thing being hovered. */
  function targetOf(overId: UniqueIdentifier, over: DragData | null) {
    if (!over) return null;
    if (over.type === "section") return { sectionId: over.sectionId, beforeId: null };
    if (over.type === "item") return { sectionId: over.sectionId, beforeId: String(overId) };
    return null;
  }

  function onDragStart(event: DragStartEvent) {
    const data = dataOf(event.active.data);
    setActive(data);
    setDropSection(data?.type === "item" ? data.sectionId : null);
  }

  function onDragOver(event: DragOverEvent) {
    const activeData = dataOf(event.active.data);
    const target = event.over ? targetOf(event.over.id, dataOf(event.over.data)) : null;
    setDropSection(target?.sectionId ?? null);
    if (!event.over || !target || activeData?.type !== "item") return;
    const current = latest.current.find((i) => i.id === event.active.id);
    // Live-move across sections while hovering; same-section order is settled on drop.
    if (current && current.sectionId !== target.sectionId) {
      updateItems((list) =>
        moveItem(list, sectionOrder, String(event.active.id), target.sectionId, target.beforeId),
      );
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeData = dataOf(event.active.data);
    setActive(null);
    setDropSection(null);
    if (!event.over || !activeData) return;
    const target = targetOf(event.over.id, dataOf(event.over.data));
    if (!target) return;

    if (activeData.type === "item") {
      const id = String(event.active.id);
      if (target.beforeId === id) return;
      const siblings = itemsOf(latest.current, target.sectionId);
      const from = siblings.findIndex((i) => i.id === id);
      const to = target.beforeId
        ? siblings.findIndex((i) => i.id === target.beforeId)
        : siblings.length;
      // Dropping onto an item below means "after it".
      const beforeId = from >= 0 && from < to ? (siblings[to + 1]?.id ?? null) : target.beforeId;
      updateItems((list) => moveItem(list, sectionOrder, id, target.sectionId, beforeId));
      return;
    }

    if (activeData.type === "library") {
      const result = await blockSnapshotAction({ blockId: activeData.blockId });
      if (!result.ok) {
        toast.error(actionErrorMessage(t, result));
        return;
      }
      const item = itemFromSnapshot(result.data, target.sectionId);
      updateItems((list) => insertItem(list, sectionOrder, item, target.beforeId));
      toast.success(t("lessons.library.added", { name: item.title }));
    }
  }

  const name = (data: unknown) => dataOf(data)?.title ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => t("lessons.dnd.picked", { name: name(a.data) }),
    onDragOver: ({ active: a, over }) =>
      over
        ? t("lessons.dnd.over", { name: name(a.data), target: name(over.data) })
        : t("lessons.dnd.overNothing", { name: name(a.data) }),
    onDragEnd: ({ active: a }) => t("lessons.dnd.dropped", { name: name(a.data) }),
    onDragCancel: () => t("lessons.dnd.cancelled"),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={() => {
        setActive(null);
        setDropSection(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("lessons.dnd.instructions") },
      }}
    >
      <DropSectionContext value={dropSection}>{children}</DropSectionContext>
      <DragOverlay>
        {active ? (
          <div className="bg-background flex items-center gap-2 rounded-lg border p-3 shadow-lg">
            <GripVertical aria-hidden className="text-muted-foreground size-4" />
            <span className="font-medium">{active.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
