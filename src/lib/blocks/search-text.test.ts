import { describe, expect, it } from "vitest";
import { richTextFromParagraphs } from "@/lib/rich-text/utils";
import { buildSearchText } from "./search-text";

describe("buildSearchText", () => {
  it("includes every searchable field and skips empty ones", () => {
    const text = buildSearchText({
      title: "Keulenfussball",
      description: richTextFromParagraphs("Jedes Kind erhält eine Keule."),
      rules: null,
      variations: ["2er Teams verteidigen eine Keule"],
      organization: richTextFromParagraphs(""),
      material: ["Keulen", "4 Fussbälle"],
      customTexts: ["Quelle: Jugi-Handbuch"],
    });
    expect(text).toBe(
      [
        "Keulenfussball",
        "Jedes Kind erhält eine Keule.",
        "2er Teams verteidigen eine Keule",
        "Keulen",
        "4 Fussbälle",
        "Quelle: Jugi-Handbuch",
      ].join("\n"),
    );
  });
});
