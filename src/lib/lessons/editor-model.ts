import type { LessonItemValues } from "./schema";
import type { TimingInput } from "./timing";

/**
 * Pure operations on the editor's item list. Items are kept in one flat
 * list, always grouped by section in section order; the order within a
 * section is the display order (and becomes sortOrder when saving).
 */

export type EditorItem = LessonItemValues;

/** Regroups items by section order, keeping the relative order inside each section. */
export function normalize(items: EditorItem[], sectionOrder: string[]): EditorItem[] {
  const rank = new Map(sectionOrder.map((id, i) => [id, i]));
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (rank.get(a.item.sectionId) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.item.sectionId) ?? Number.MAX_SAFE_INTEGER) || a.index - b.index,
    )
    .map((x) => x.item);
}

export function itemsOf(items: EditorItem[], sectionId: string) {
  return items.filter((i) => i.sectionId === sectionId);
}

/**
 * Moves an item to `toSection`, before the item `beforeId` (or to the end
 * when null). Works within a section and across sections.
 */
export function moveItem(
  items: EditorItem[],
  sectionOrder: string[],
  itemId: string,
  toSection: string,
  beforeId: string | null,
): EditorItem[] {
  const item = items.find((i) => i.id === itemId);
  if (!item || itemId === beforeId) return items;
  const rest = items.filter((i) => i.id !== itemId);
  const moved = { ...item, sectionId: toSection };
  return insertItem(rest, sectionOrder, moved, beforeId);
}

/** Inserts a new item into its section, before `beforeId` or at the end. */
export function insertItem(
  items: EditorItem[],
  sectionOrder: string[],
  item: EditorItem,
  beforeId: string | null,
): EditorItem[] {
  const target = beforeId ? items.findIndex((i) => i.id === beforeId) : -1;
  if (target >= 0 && items[target]!.sectionId === item.sectionId) {
    return normalize([...items.slice(0, target), item, ...items.slice(target)], sectionOrder);
  }
  // End of the section: after its last item (normalize keeps that order).
  return normalize([...items, item], sectionOrder);
}

/** One step up or down within the section. */
export function nudgeItem(
  items: EditorItem[],
  sectionOrder: string[],
  itemId: string,
  direction: -1 | 1,
): EditorItem[] {
  const item = items.find((i) => i.id === itemId);
  if (!item) return items;
  const siblings = itemsOf(items, item.sectionId);
  const index = siblings.findIndex((i) => i.id === itemId);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return items;
  const reordered = [...siblings];
  [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
  const others = items.filter((i) => i.sectionId !== item.sectionId);
  return normalize([...others, ...reordered], sectionOrder);
}

export function parseMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 600 ? n : null;
}

/** Input for computeLessonTiming from the editor's (string) form values. */
export function timingInput(
  items: EditorItem[],
  sectionOrder: string[],
  startTime: number | null,
  planned: number | null,
): TimingInput {
  return {
    startTimeMinutes: startTime,
    plannedDurationMinutes: planned,
    sections: sectionOrder.map((id) => ({
      id,
      items: itemsOf(items, id).map((i) => ({
        id: i.id,
        durationMinutes: parseMinutes(i.durationMinutes),
      })),
    })),
  };
}

/** A fresh one-off item (not from the library). */
export function blankItem(
  id: string,
  sectionId: string,
  title: string,
  durationMinutes: string,
): EditorItem {
  return {
    id,
    sectionId,
    sourceBlockId: null,
    modifiedLocally: false,
    responsible: { kind: "none" },
    title,
    durationMinutes,
    description: null,
    rules: null,
    variations: [],
    organization: null,
    material: [],
    sketchAssetIds: [],
    teamCount: "",
    minParticipants: "",
    maxParticipants: "",
    customValues: {},
  };
}
