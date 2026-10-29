import type { CustomFieldType } from "@/generated/prisma/enums";
import { richTextSchema } from "@/lib/rich-text/schema";
import { richTextToPlainText } from "@/lib/rich-text/utils";

export type FieldMeta = { id: string; type: CustomFieldType; searchable: boolean };

/** Plain-text values of searchable custom fields, for the search index. */
export function searchableCustomTexts(fields: FieldMeta[], values: Record<string, unknown>) {
  const texts: string[] = [];
  for (const field of fields) {
    if (!field.searchable) continue;
    const value = values[field.id];
    if (value === undefined || value === null) continue;
    if (field.type === "SHORT_TEXT" && typeof value === "string") texts.push(value);
    if (field.type === "LIST" && Array.isArray(value)) {
      texts.push(...value.filter((v): v is string => typeof v === "string"));
    }
    if (field.type === "LONG_TEXT") {
      const doc = richTextSchema.safeParse(value);
      if (doc.success) texts.push(richTextToPlainText(doc.data));
    }
  }
  return texts;
}

/** Asset ids referenced by image custom fields. */
export function imageAssetIds(fields: FieldMeta[], values: Record<string, unknown>) {
  return fields
    .filter((f) => f.type === "IMAGE")
    .map((f) => values[f.id])
    .filter((v): v is string => typeof v === "string");
}

/**
 * New values for active fields, plus the stored values of archived fields
 * (which the editor does not show) so saving never drops them.
 */
export function mergeCustomValues(
  activeFieldIds: Set<string>,
  submitted: Record<string, unknown>,
  stored: Record<string, unknown>,
) {
  const kept = Object.fromEntries(Object.entries(stored).filter(([id]) => !activeFieldIds.has(id)));
  return { ...kept, ...submitted };
}
