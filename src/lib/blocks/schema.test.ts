import { describe, expect, it } from "vitest";
import { richTextFromParagraphs } from "@/lib/rich-text/utils";
import { blockInputSchema, customValuesSchema, type BlockFormValues } from "./schema";

const uuid = (n: number) => `0192f0c1-7a3b-7c4d-8e5f-${String(n).padStart(12, "0")}`;

const valid: BlockFormValues = {
  title: "Keulenfussball",
  durationMinutes: "20",
  description: richTextFromParagraphs("Jedes Kind erhält eine Keule."),
  rules: null,
  variations: ["2er Teams verteidigen eine Keule"],
  organization: null,
  material: ["Keulen", "4 Fussbälle"],
  responsible: { kind: "none" },
  sketchAssetIds: [],
  tagIds: [uuid(1)],
  teamIds: [],
  suggestedSectionId: uuid(2),
  ageMin: "7",
  ageMax: "14",
  difficulty: "MEDIUM",
  customValues: {},
};

describe("blockInputSchema", () => {
  it("parses a complete block and coerces numbers", () => {
    const parsed = blockInputSchema.parse(valid);
    expect(parsed).toMatchObject({ durationMinutes: 20, ageMin: 7, ageMax: 14 });
  });

  it("treats empty number inputs as not set", () => {
    const parsed = blockInputSchema.parse({
      ...valid,
      durationMinutes: "",
      ageMin: "",
      ageMax: "",
    });
    expect(parsed).toMatchObject({ durationMinutes: null, ageMin: null, ageMax: null });
  });

  it.each<[string, Partial<BlockFormValues>]>([
    ["missing title", { title: "  " }],
    ["negative duration", { durationMinutes: "-5" }],
    ["fractional duration", { durationMinutes: "2.5" }],
    ["age range reversed", { ageMin: "12", ageMax: "8" }],
    ["unknown difficulty", { difficulty: "EXTREME" as never }],
    ["duplicate tags", { tagIds: [uuid(1), uuid(1)] }],
    ["too many sketches", { sketchAssetIds: Array.from({ length: 11 }, (_, i) => uuid(i)) }],
    ["empty list entry", { material: ["Keulen", " "] }],
    ["control characters", { variations: [`a${String.fromCharCode(7)}b`] }],
    ["HTML in rich text", { description: "<p>x</p>" as never }],
    ["unknown responsible kind", { responsible: { kind: "team" } as never }],
    ["responsible coach without id", { responsible: { kind: "coach" } as never }],
  ])("rejects %s", (_label, patch) => {
    expect(blockInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("rejects unknown top-level keys", () => {
    expect(blockInputSchema.safeParse({ ...valid, clubId: uuid(9) }).success).toBe(false);
  });
});

describe("customValuesSchema", () => {
  const schema = customValuesSchema([
    { id: uuid(10), type: "SHORT_TEXT" },
    { id: uuid(11), type: "LONG_TEXT" },
    { id: uuid(12), type: "LIST" },
    { id: uuid(13), type: "NUMBER" },
    { id: uuid(14), type: "IMAGE" },
  ]);

  it("accepts values matching each field type, all optional", () => {
    expect(
      schema.parse({
        [uuid(10)]: "Jugi-Handbuch",
        [uuid(11)]: richTextFromParagraphs("Lernziel"),
        [uuid(12)]: ["a", "b"],
        [uuid(13)]: "42",
        [uuid(14)]: uuid(99),
      }),
    ).toMatchObject({ [uuid(13)]: 42 });
    expect(schema.parse({})).toEqual({});
  });

  it.each([
    ["unknown field", { [uuid(50)]: "x" }],
    ["wrong type for list", { [uuid(12)]: "a" }],
    ["empty list", { [uuid(12)]: [] }],
    ["not a number", { [uuid(13)]: "viele" }],
    ["image that is not an asset id", { [uuid(14)]: "https://evil.example/x.png" }],
    ["rich text as plain string", { [uuid(11)]: "<b>x</b>" }],
  ])("rejects %s", (_label, values) => {
    expect(schema.safeParse(values).success).toBe(false);
  });
});
