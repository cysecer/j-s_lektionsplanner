import type { Difficulty } from "@/generated/prisma/enums";
import { richTextSchema, type RichText } from "@/lib/rich-text/schema";
import { computeLessonTiming } from "./timing";

/**
 * Everything a lesson document (read view, layout preview, PDF) shows, as
 * plain serializable data. Built once on the server from the database rows,
 * so the renderer stays a pure function of (document, layout).
 */
export type LessonDocument = {
  title: string;
  authorName: string | null;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  teamName: string | null;
  startTimeMinutes: number | null;
  totalDurationMinutes: number | null;
  location: string | null;
  ageMin: number | null;
  ageMax: number | null;
  groupSize: string | null;
  difficulty: Difficulty | null;
  safety: RichText | null;
  goals: RichText | null;
  notes: RichText | null;
  presentCoaches: string[];
  sections: { id: string; title: string; items: LessonDocumentItem[] }[];
};

export type LessonDocumentItem = {
  id: string;
  title: string;
  durationMinutes: number | null;
  /** Clock time of the item's start, or null without a lesson start time. */
  startTimeMinutes: number | null;
  description: RichText | null;
  rules: RichText | null;
  variations: string[];
  organization: RichText | null;
  sketchAssetIds: string[];
  material: string[];
  responsible: string | null;
  teamCount: number | null;
  minParticipants: number | null;
  maxParticipants: number | null;
  customValues: Record<string, unknown>;
};

/** Club-wide context of a document. */
export type DocumentClub = {
  name: string;
  logoAssetId: string | null;
  footerText: string | null;
  /** Custom fields that layouts may reference (archived ones included, for old lessons). */
  fields: { id: string; label: string; type: string }[];
  /** Images as data URIs by asset id, where there is no session to load them (PDF). */
  inlineAssets?: Record<string, string>;
};

type LessonRow = {
  title: string;
  authorName: string | null;
  date: Date;
  team: { name: string } | null;
  startTimeMinutes: number | null;
  totalDurationMinutes: number | null;
  location: string | null;
  ageMin: number | null;
  ageMax: number | null;
  groupSize: string | null;
  difficulty: Difficulty | null;
  safety: unknown;
  goals: unknown;
  notes: unknown;
  presentCoaches: { coachId: string }[];
  items: {
    id: string;
    sectionId: string;
    title: string;
    durationMinutes: number | null;
    description: unknown;
    rules: unknown;
    variations: string[];
    organization: unknown;
    sketches: { assetId: string }[];
    material: string[];
    responsibleCoach: { name: string } | null;
    responsibleText: string | null;
    teamCount: number | null;
    minParticipants: number | null;
    maxParticipants: number | null;
    customValues: unknown;
  }[];
};

const richText = (value: unknown): RichText | null => {
  const parsed = richTextSchema.safeParse(value);
  return parsed.success && parsed.data.content.length > 0 ? parsed.data : null;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * @param sections all sections of the club in display order, with their display titles
 * @param coachNames names of coaches by id (for the present coaches)
 */
export function buildLessonDocument(
  lesson: LessonRow,
  sections: { id: string; title: string }[],
  coachNames: Map<string, string>,
): LessonDocument {
  const timing = computeLessonTiming({
    startTimeMinutes: lesson.startTimeMinutes,
    plannedDurationMinutes: lesson.totalDurationMinutes,
    sections: sections.map((s) => ({
      id: s.id,
      items: lesson.items.filter((i) => i.sectionId === s.id),
    })),
  });

  return {
    title: lesson.title,
    authorName: lesson.authorName,
    date: lesson.date.toISOString().slice(0, 10),
    teamName: lesson.team?.name ?? null,
    startTimeMinutes: lesson.startTimeMinutes,
    totalDurationMinutes: lesson.totalDurationMinutes,
    location: lesson.location,
    ageMin: lesson.ageMin,
    ageMax: lesson.ageMax,
    groupSize: lesson.groupSize,
    difficulty: lesson.difficulty,
    safety: richText(lesson.safety),
    goals: richText(lesson.goals),
    notes: richText(lesson.notes),
    presentCoaches: lesson.presentCoaches
      .map((c) => coachNames.get(c.coachId))
      .filter((name): name is string => Boolean(name)),
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      items: lesson.items
        .filter((i) => i.sectionId === section.id)
        .map((item) => ({
          id: item.id,
          title: item.title,
          durationMinutes: item.durationMinutes,
          startTimeMinutes: timing.items[item.id]?.startTimeMinutes ?? null,
          description: richText(item.description),
          rules: richText(item.rules),
          variations: item.variations,
          organization: richText(item.organization),
          sketchAssetIds: item.sketches.map((s) => s.assetId),
          material: item.material,
          responsible: item.responsibleCoach?.name ?? item.responsibleText ?? null,
          teamCount: item.teamCount,
          minParticipants: item.minParticipants,
          maxParticipants: item.maxParticipants,
          customValues: record(item.customValues),
        })),
    })),
  };
}
