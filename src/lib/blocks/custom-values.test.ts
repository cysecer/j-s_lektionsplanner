import { describe, expect, it } from "vitest";
import { richTextFromParagraphs } from "@/lib/rich-text/utils";
import {
  imageAssetIds,
  mergeCustomValues,
  searchableCustomTexts,
  type FieldMeta,
} from "./custom-values";

const fields: FieldMeta[] = [
  { id: "short", type: "SHORT_TEXT", searchable: true },
  { id: "long", type: "LONG_TEXT", searchable: true },
  { id: "list", type: "LIST", searchable: true },
  { id: "hidden", type: "SHORT_TEXT", searchable: false },
  { id: "num", type: "NUMBER", searchable: false },
  { id: "img", type: "IMAGE", searchable: false },
];

describe("custom values", () => {
  it("collects text of searchable fields only", () => {
    expect(
      searchableCustomTexts(fields, {
        short: "Jugi-Handbuch",
        long: richTextFromParagraphs("Fairplay üben"),
        list: ["Hütchen", "Bänder"],
        hidden: "geheim",
        num: 3,
      }),
    ).toEqual(["Jugi-Handbuch", "Fairplay üben", "Hütchen", "Bänder"]);
  });

  it("finds image asset ids", () => {
    expect(imageAssetIds(fields, { img: "a-1", short: "x" })).toEqual(["a-1"]);
  });

  it("keeps values of archived fields when saving", () => {
    expect(
      mergeCustomValues(new Set(["short"]), { short: "neu" }, { short: "alt", archived: "bleibt" }),
    ).toEqual({ short: "neu", archived: "bleibt" });
  });

  it("drops a cleared active field", () => {
    expect(mergeCustomValues(new Set(["short"]), {}, { short: "alt" })).toEqual({});
  });
});
