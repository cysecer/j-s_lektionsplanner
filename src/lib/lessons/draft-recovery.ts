import type { EditorItem } from "./editor-model";
import type { LessonGeneralValues } from "./schema";

/**
 * A copy of a new, not yet stored lesson in the browser, so a reload, a
 * crash or the back button does not lose it. Only on this device; removed
 * once the lesson is stored or discarded. Browser storage can be missing
 * (private mode, blocked): then there is simply no copy.
 */
const KEY = "lektionsplaner:new-lesson";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type RecoveredDraft = {
  savedAt: string;
  general: LessonGeneralValues;
  items: EditorItem[];
};

export function storeNewLessonDraft(draft: Omit<RecoveredDraft, "savedAt">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    // No storage available: nothing to recover later.
  }
}

/** The stored copy as text (stable between calls, for useSyncExternalStore). */
export function newLessonDraftSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parseNewLessonDraft(raw: string | null): RecoveredDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<RecoveredDraft>;
    const age = Date.now() - new Date(draft.savedAt ?? "").getTime();
    if (!draft.general || !Array.isArray(draft.items) || !(age >= 0 && age < MAX_AGE_MS)) {
      return null;
    }
    // Stored by this app; the server validates everything on saving anyway.
    return draft as RecoveredDraft;
  } catch {
    return null;
  }
}

export function clearNewLessonDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
