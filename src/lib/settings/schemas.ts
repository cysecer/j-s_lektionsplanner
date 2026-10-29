import { z } from "zod";
import { CustomFieldType, Role } from "@/generated/prisma/enums";
import { localeSchema } from "@/i18n/config";
import { clockTimeSchema } from "@/lib/lessons/timing";

/** Single-line display name: trimmed, no control characters, bounded length. */
export function displayName(max: number) {
  return z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .max(max, { message: "validation.tooLong" })
    .refine((v) => !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(v), { message: "validation.invalid" });
}

export const durationMinutesSchema = z.coerce
  .number({ message: "validation.durationRange" })
  .int({ message: "validation.wholeNumber" })
  .min(1, { message: "validation.durationRange" })
  .max(1440, { message: "validation.durationRange" });

/** Accepts "HH:MM" or an empty string (= not set). */
const optionalClockTime = z.union([z.literal("").transform(() => null), clockTimeSchema]);
/** Accepts a number of minutes or an empty string (= not set). */
const optionalDuration = z.union([z.literal("").transform(() => null), durationMinutesSchema]);

const uuidList = (max: number) =>
  z
    .array(z.uuid())
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length, { message: "validation.invalid" });

export const idSchema = z.strictObject({ id: z.uuid() });

export const reorderSchema = z.strictObject({ ids: uuidList(200).min(1) });

export const clubSettingsSchema = z.strictObject({
  name: displayName(100),
  pdfFooterText: z.union([z.literal("").transform(() => null), displayName(120)]),
  defaultStartTime: clockTimeSchema,
  defaultDurationMinutes: durationMinutesSchema,
  /** PDFs per reader and day; 0 = readers cannot export. Empty is an error, not 0. */
  readerPdfDailyLimit: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce
      .number({ message: "validation.wholeNumber" })
      .int({ message: "validation.wholeNumber" })
      .min(0, { message: "validation.numberMin" })
      .max(1000, { message: "validation.numberMax" }),
  ),
});

export const clubLogoSchema = z.strictObject({ assetId: z.uuid().nullable() });

export const teamSchema = z.strictObject({
  name: displayName(60),
  defaultStartTime: optionalClockTime,
  defaultDurationMinutes: optionalDuration,
  /** Drafts visible only to their creator (and admins) until published. */
  privateDrafts: z.boolean(),
});
export const teamUpdateSchema = teamSchema.extend({ id: z.uuid() });

export const coachSchema = z.strictObject({ name: displayName(80), teamIds: uuidList(100) });
export const coachUpdateSchema = coachSchema.extend({ id: z.uuid() });

export const tagSchema = z.strictObject({ name: displayName(40) });
export const tagUpdateSchema = tagSchema.extend({ id: z.uuid() });

/** Built-in sections may reset their name to the translated default (null). */
export const sectionSchema = z.strictObject({ name: displayName(60) });
export const sectionUpdateSchema = z.strictObject({
  id: z.uuid(),
  name: z.union([z.literal("").transform(() => null), displayName(60)]),
});

export const customFieldSchema = z.strictObject({
  label: displayName(60),
  type: z.enum(CustomFieldType),
  searchable: z.boolean(),
  filterable: z.boolean(),
});
/** The type cannot change after creation: existing values would no longer fit. */
export const customFieldUpdateSchema = customFieldSchema
  .omit({ type: true })
  .extend({ id: z.uuid() });

export const invitePersonSchema = z.strictObject({
  email: z
    .email({ message: "validation.email" })
    .max(254)
    .transform((e) => e.toLowerCase()),
  role: z.enum(Role),
  coachId: z.uuid().nullable(),
  locale: localeSchema,
});

export const memberUpdateSchema = z.strictObject({
  membershipId: z.uuid(),
  role: z.enum(Role),
  coachId: z.uuid().nullable(),
});

export const membershipIdSchema = z.strictObject({ membershipId: z.uuid() });
export const invitationIdSchema = z.strictObject({ invitationId: z.uuid() });

/** Which custom field types make sense for search and filters. */
export const SEARCHABLE_TYPES: readonly CustomFieldType[] = ["SHORT_TEXT", "LONG_TEXT", "LIST"];
export const FILTERABLE_TYPES: readonly CustomFieldType[] = ["SHORT_TEXT", "NUMBER"];
