import type { EditorItem } from "@/lib/lessons/editor-model";
import type { snapshotFromBlock } from "@/lib/lessons/service";

export type BlockSnapshot = Awaited<ReturnType<typeof snapshotFromBlock>>;

/** A lesson item copied from a library block (the snapshot). */
export function itemFromSnapshot(snapshot: BlockSnapshot, sectionId: string): EditorItem {
  const { sourceBlockId, suggestedSectionId: _suggested, ...content } = snapshot;
  return {
    id: crypto.randomUUID(),
    sectionId,
    sourceBlockId,
    modifiedLocally: false,
    responsible: { kind: "none" },
    ...content,
  };
}
