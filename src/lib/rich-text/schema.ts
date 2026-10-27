import { z } from "zod";

/**
 * Lightweight rich text: a strict subset of the Tiptap/ProseMirror JSON format.
 * Only paragraphs, bullet lists, bold and italic are allowed. Anything else
 * (links, images, HTML, unknown attributes) is rejected, so stored content can
 * be rendered without sanitising HTML.
 */

export const RICH_TEXT_MAX_TEXT_LENGTH = 5_000;
export const RICH_TEXT_MAX_BLOCKS = 100;
export const RICH_TEXT_MAX_SERIALIZED_LENGTH = 50_000;

const markSchema = z.strictObject({ type: z.enum(["bold", "italic"]) });

const textNodeSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1).max(RICH_TEXT_MAX_TEXT_LENGTH),
  marks: z.array(markSchema).max(2).optional(),
});

const hardBreakSchema = z.strictObject({ type: z.literal("hardBreak") });

const inlineSchema = z.discriminatedUnion("type", [textNodeSchema, hardBreakSchema]);

const paragraphSchema = z.strictObject({
  type: z.literal("paragraph"),
  content: z.array(inlineSchema).max(500).optional(),
});

const listItemSchema = z.strictObject({
  type: z.literal("listItem"),
  content: z.array(paragraphSchema).min(1).max(10),
});

const bulletListSchema = z.strictObject({
  type: z.literal("bulletList"),
  content: z.array(listItemSchema).min(1).max(RICH_TEXT_MAX_BLOCKS),
});

const blockSchema = z.discriminatedUnion("type", [paragraphSchema, bulletListSchema]);

export const richTextSchema = z
  .strictObject({
    type: z.literal("doc"),
    content: z.array(blockSchema).max(RICH_TEXT_MAX_BLOCKS),
  })
  .refine((doc) => JSON.stringify(doc).length <= RICH_TEXT_MAX_SERIALIZED_LENGTH, {
    message: "validation.richTextTooLong",
  });

export type RichText = z.infer<typeof richTextSchema>;
export type RichTextBlock = z.infer<typeof blockSchema>;
export type RichTextParagraph = z.infer<typeof paragraphSchema>;
export type RichTextInline = z.infer<typeof inlineSchema>;
