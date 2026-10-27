import { describe, expect, it } from "vitest";
import { negotiateLocale } from "./config";

describe("negotiateLocale", () => {
  it.each([
    [null, "de-CH"],
    ["", "de-CH"],
    ["de-CH,de;q=0.9", "de-CH"],
    ["de-DE", "de-CH"],
    ["fr-FR,fr;q=0.9,en;q=0.8", "fr-CH"],
    ["it", "it-CH"],
    ["rm-CH", "rm"],
    ["en-US,en;q=0.9", "en"],
    ["es-ES,en;q=0.5", "en"],
    ["es-ES", "de-CH"],
    ["en;q=0.2,fr;q=0.8", "fr-CH"],
    ["fr;q=0", "de-CH"],
    ["garbage;;;", "de-CH"],
  ])("maps %j to %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });
});
