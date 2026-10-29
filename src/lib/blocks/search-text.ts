import type { RichText } from "@/lib/rich-text/schema";
import { richTextToPlainText } from "@/lib/rich-text/utils";

export type SearchableBlockContent = {
  title: string;
  description: RichText | null;
  rules: RichText | null;
  variations: string[];
  organization: RichText | null;
  material: string[];
  /** Plain-text values of custom fields marked as searchable. */
  customTexts: string[];
};

/**
 * Concatenates everything that full-text search should find into one string.
 * Stored in ProgramBlock.searchText and indexed with Postgres' German config.
 */
export function buildSearchText(block: SearchableBlockContent): string {
  return [
    block.title,
    richTextToPlainText(block.description),
    richTextToPlainText(block.rules),
    ...block.variations,
    richTextToPlainText(block.organization),
    ...block.material,
    ...block.customTexts,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
}
