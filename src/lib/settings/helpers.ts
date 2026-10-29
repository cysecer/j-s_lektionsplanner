import "server-only";
import { ActionFailure } from "@/lib/server/result";

/** updateMany/deleteMany scoped by club: zero rows means "not yours" or "gone". */
export function assertFound(result: { count: number }) {
  if (result.count === 0) throw new ActionFailure("notFound");
}

/**
 * A reorder request must list exactly the existing items, so it can neither
 * smuggle in foreign ids nor silently drop items.
 */
export function assertSameIds(requested: string[], existing: string[]) {
  const have = new Set(existing);
  if (requested.length !== have.size || requested.some((id) => !have.has(id))) {
    throw new ActionFailure("validation", "reorderMismatch");
  }
}

export function nextSortOrder(items: { sortOrder: number }[]) {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
}
