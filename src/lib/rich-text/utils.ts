import type { RichText, RichTextBlock, RichTextParagraph } from "./schema";

export const EMPTY_RICH_TEXT: RichText = { type: "doc", content: [] };

function paragraph(text: string): RichTextParagraph {
  return text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
}

/** Builds a document with one paragraph per string. */
export function richTextFromParagraphs(...texts: string[]): RichText {
  return { type: "doc", content: texts.map(paragraph) };
}

/** Builds a document with a single bullet list. */
export function richTextFromBullets(items: string[]): RichText {
  if (items.length === 0) return EMPTY_RICH_TEXT;
  return {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
      },
    ],
  };
}

function paragraphText(p: RichTextParagraph): string {
  return (p.content ?? []).map((node) => (node.type === "text" ? node.text : "\n")).join("");
}

function blockText(block: RichTextBlock): string {
  if (block.type === "paragraph") return paragraphText(block);
  return block.content.map((item) => item.content.map(paragraphText).join("\n")).join("\n");
}

/** Plain text for search indexing and previews. */
export function richTextToPlainText(doc: RichText | null | undefined): string {
  if (!doc) return "";
  return doc.content.map(blockText).join("\n").trim();
}

export function isRichTextEmpty(doc: RichText | null | undefined): boolean {
  return richTextToPlainText(doc) === "";
}
