import type { getBlock } from "./queries";
import type { BlockFormValues } from "./schema";
import type { RichText } from "@/lib/rich-text/schema";

export const EMPTY_BLOCK: BlockFormValues = {
  title: "",
  durationMinutes: "",
  description: null,
  rules: null,
  variations: [],
  organization: null,
  material: [],
  sketchAssetIds: [],
  tagIds: [],
  teamIds: [],
  suggestedSectionId: null,
  ageMin: "",
  ageMax: "",
  teamCount: "",
  minParticipants: "",
  maxParticipants: "",
  difficulty: null,
  customValues: {},
};

type StoredBlock = NonNullable<Awaited<ReturnType<typeof getBlock>>>;

/** Converts a stored block into editor values (only active custom fields). */
export function blockToFormValues(block: StoredBlock, activeFieldIds: string[]): BlockFormValues {
  const stored = (block.customValues ?? {}) as Record<string, unknown>;
  return {
    title: block.title,
    durationMinutes: block.durationMinutes === null ? "" : String(block.durationMinutes),
    description: block.description as RichText | null,
    rules: block.rules as RichText | null,
    variations: block.variations,
    organization: block.organization as RichText | null,
    material: block.material,
    sketchAssetIds: block.sketches.map((s) => s.assetId),
    tagIds: block.tags.map((t) => t.tagId),
    teamIds: block.teams.map((t) => t.teamId),
    suggestedSectionId: block.suggestedSectionId,
    ageMin: block.ageMin === null ? "" : String(block.ageMin),
    ageMax: block.ageMax === null ? "" : String(block.ageMax),
    teamCount: block.teamCount === null ? "" : String(block.teamCount),
    minParticipants: block.minParticipants === null ? "" : String(block.minParticipants),
    maxParticipants: block.maxParticipants === null ? "" : String(block.maxParticipants),
    difficulty: block.difficulty,
    customValues: Object.fromEntries(
      Object.entries(stored).filter(([id]) => activeFieldIds.includes(id)),
    ),
  };
}
