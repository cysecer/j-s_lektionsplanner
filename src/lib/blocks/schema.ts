import { z } from "zod";
import { CustomFieldType, Difficulty } from "@/generated/prisma/enums";
import { richTextSchema } from "@/lib/rich-text/schema";
import { displayName } from "@/lib/settings/schemas";

export const BLOCK_LIMITS = {
  title: 150,
  listItem: 300,
  variations: 30,
  material: 40,
  sketches: 10,
  tags: 30,
  teams: 50,
  durationMax: 600,
  ageMax: 120,
  teamCountMax: 50,
  participantsMax: 500,
} as const;

export const uuidSet = (max: number) =>
  z
    .array(z.uuid())
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length, { message: "validation.invalid" });

/** Number inputs arrive as strings; "" means "not set". */
export const optionalInt = (min: number, max: number) =>
  z.union([
    z.literal("").transform(() => null),
    z.null(),
    z.coerce
      .number({ message: "validation.numberRange" })
      .int({ message: "validation.wholeNumber" })
      .min(min, { message: "validation.numberRange" })
      .max(max, { message: "validation.numberRange" }),
  ]);

/** Responsible person of a lesson item (blocks themselves have none). */
export const responsibleSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none") }),
  z.strictObject({ kind: z.literal("coach"), coachId: z.uuid() }),
  z.strictObject({ kind: z.literal("text"), text: displayName(100) }),
]);
export type Responsible = z.infer<typeof responsibleSchema>;

/**
 * What a game/exercise consists of. Shared by library blocks and lesson
 * items (a lesson item is a snapshot copy of this content).
 */
export const blockContentShape = {
  title: displayName(BLOCK_LIMITS.title),
  durationMinutes: optionalInt(0, BLOCK_LIMITS.durationMax),
  description: richTextSchema.nullable(),
  rules: richTextSchema.nullable(),
  variations: z.array(displayName(BLOCK_LIMITS.listItem)).max(BLOCK_LIMITS.variations),
  organization: richTextSchema.nullable(),
  material: z.array(displayName(BLOCK_LIMITS.listItem)).max(BLOCK_LIMITS.material),
  sketchAssetIds: uuidSet(BLOCK_LIMITS.sketches),
  teamCount: optionalInt(1, BLOCK_LIMITS.teamCountMax),
  minParticipants: optionalInt(1, BLOCK_LIMITS.participantsMax),
  maxParticipants: optionalInt(1, BLOCK_LIMITS.participantsMax),
  /** Validated against the club's field definitions with customValuesSchema(). */
  customValues: z.record(z.uuid(), z.unknown()),
};

export function participantsInOrder(b: {
  minParticipants: number | null;
  maxParticipants: number | null;
}) {
  return (
    b.minParticipants === null ||
    b.maxParticipants === null ||
    b.minParticipants <= b.maxParticipants
  );
}
export const participantsRangeIssue = {
  message: "validation.participantsRange",
  path: ["maxParticipants"],
};

export const blockContentSchema = z
  .strictObject(blockContentShape)
  .refine(participantsInOrder, participantsRangeIssue);
export type BlockContent = z.output<typeof blockContentSchema>;
export type BlockContentValues = z.input<typeof blockContentSchema>;

export const blockInputSchema = z
  .strictObject({
    ...blockContentShape,
    tagIds: uuidSet(BLOCK_LIMITS.tags),
    /** Empty = available to the whole club. */
    teamIds: uuidSet(BLOCK_LIMITS.teams),
    suggestedSectionId: z.uuid().nullable(),
    ageMin: optionalInt(0, BLOCK_LIMITS.ageMax),
    ageMax: optionalInt(0, BLOCK_LIMITS.ageMax),
    difficulty: z.enum(Difficulty).nullable(),
  })
  .refine((b) => b.ageMin === null || b.ageMax === null || b.ageMin <= b.ageMax, {
    message: "validation.ageRange",
    path: ["ageMax"],
  })
  .refine(participantsInOrder, participantsRangeIssue);

export type BlockInput = z.output<typeof blockInputSchema>;
export type BlockFormValues = z.input<typeof blockInputSchema>;

export type CustomFieldDefinition = { id: string; type: CustomFieldType };

const customValueSchemas: Record<CustomFieldType, z.ZodType> = {
  SHORT_TEXT: displayName(200),
  LONG_TEXT: richTextSchema,
  LIST: z.array(displayName(BLOCK_LIMITS.listItem)).min(1).max(50),
  NUMBER: z.coerce
    .number({ message: "validation.invalid" })
    .finite()
    .min(-1_000_000_000)
    .max(1_000_000_000),
  IMAGE: z.uuid(),
};

/**
 * Values for the club's active custom fields. Unknown keys are rejected;
 * empty fields are simply left out of the map.
 */
export function customValuesSchema(fields: CustomFieldDefinition[]) {
  return z.strictObject(
    Object.fromEntries(fields.map((f) => [f.id, customValueSchemas[f.type].optional()])),
  );
}
