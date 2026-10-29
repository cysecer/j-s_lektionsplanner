import { formatClockTime } from "./timing";
import type { getLesson } from "./queries";
import type { LessonGeneralValues } from "./schema";
import type { EditorItem } from "./editor-model";
import type { RichText } from "@/lib/rich-text/schema";

type StoredLesson = NonNullable<Awaited<ReturnType<typeof getLesson>>>;

const n = (v: number | null) => (v === null ? "" : String(v));

/** Stored lesson → editor form values (numbers and times as strings). */
export function lessonToEditorValues(lesson: StoredLesson): {
  general: LessonGeneralValues;
  items: EditorItem[];
  version: string;
} {
  return {
    version: lesson.updatedAt.toISOString(),
    general: {
      title: lesson.title,
      authorName: lesson.authorName,
      date: lesson.date.toISOString().slice(0, 10),
      teamId: lesson.teamId,
      layoutId: lesson.layoutId,
      startTime: lesson.startTimeMinutes === null ? "" : formatClockTime(lesson.startTimeMinutes),
      totalDurationMinutes: n(lesson.totalDurationMinutes),
      location: lesson.location ?? "",
      ageMin: n(lesson.ageMin),
      ageMax: n(lesson.ageMax),
      groupSize: lesson.groupSize ?? "",
      difficulty: lesson.difficulty,
      safety: lesson.safety as RichText | null,
      goals: lesson.goals as RichText | null,
      notes: lesson.notes as RichText | null,
      presentCoachIds: lesson.presentCoaches.map((c) => c.coachId),
      status: lesson.status,
    },
    items: lesson.items.map((item) => ({
      id: item.id,
      sectionId: item.sectionId,
      sourceBlockId: item.sourceBlockId,
      modifiedLocally: item.modifiedLocally,
      responsible: item.responsibleCoachId
        ? { kind: "coach", coachId: item.responsibleCoachId }
        : item.responsibleText
          ? { kind: "text", text: item.responsibleText }
          : { kind: "none" },
      title: item.title,
      durationMinutes: n(item.durationMinutes),
      description: item.description as RichText | null,
      rules: item.rules as RichText | null,
      variations: item.variations,
      organization: item.organization as RichText | null,
      material: item.material,
      sketchAssetIds: item.sketches.map((s) => s.assetId),
      teamCount: n(item.teamCount),
      minParticipants: n(item.minParticipants),
      maxParticipants: n(item.maxParticipants),
      customValues: (item.customValues ?? {}) as Record<string, unknown>,
    })),
  };
}
