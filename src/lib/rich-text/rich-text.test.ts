import { describe, expect, it } from "vitest";
import { RICH_TEXT_MAX_TEXT_LENGTH, richTextSchema } from "./schema";
import {
  isRichTextEmpty,
  richTextFromBullets,
  richTextFromParagraphs,
  richTextToPlainText,
} from "./utils";

describe("richTextSchema", () => {
  it("accepts paragraphs, bullet lists, bold and italic", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Edelsteine", marks: [{ type: "bold" }] },
            { type: "hardBreak" },
            { type: "text", text: "nicht werfen", marks: [{ type: "italic" }] },
          ],
        },
        richTextFromBullets(["Variante A"]).content[0],
      ],
    };
    expect(richTextSchema.safeParse(doc).success).toBe(true);
  });

  it.each([
    ["an unknown node type", { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] }],
    [
      "an unknown mark",
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
        ],
      },
    ],
    ["extra attributes", { type: "doc", content: [{ type: "paragraph", attrs: { style: "x" } }] }],
    [
      "empty text nodes",
      { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }] },
    ],
    [
      "overlong text",
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "a".repeat(RICH_TEXT_MAX_TEXT_LENGTH + 1) }],
          },
        ],
      },
    ],
    ["a non-doc root", { type: "paragraph" }],
    ["a string", "<b>hi</b>"],
  ])("rejects %s", (_label, input) => {
    expect(richTextSchema.safeParse(input).success).toBe(false);
  });
});

describe("rich text helpers", () => {
  it("round-trips paragraphs and bullets to plain text", () => {
    expect(richTextToPlainText(richTextFromParagraphs("Eins", "Zwei"))).toBe("Eins\nZwei");
    expect(richTextToPlainText(richTextFromBullets(["A", "B"]))).toBe("A\nB");
  });

  it("detects empty documents", () => {
    expect(isRichTextEmpty(richTextFromParagraphs(""))).toBe(true);
    expect(isRichTextEmpty(null)).toBe(true);
    expect(isRichTextEmpty(richTextFromParagraphs("x"))).toBe(false);
  });

  it("produces documents that pass validation", () => {
    expect(richTextSchema.safeParse(richTextFromParagraphs("a", "")).success).toBe(true);
    expect(richTextSchema.safeParse(richTextFromBullets([])).success).toBe(true);
  });
});
