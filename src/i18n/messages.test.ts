import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES } from "./config";
import { mergeMessages } from "./messages";

type Tree = { [key: string]: string | Tree };

function load(locale: string): Tree {
  const file = path.resolve(__dirname, "../../messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Tree;
}

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(full, value);
    else for (const [k, v] of flatten(value, full)) result.set(k, v);
  }
  return result;
}

/** Top-level ICU argument names, e.g. "{name}" or "{count, plural, …}". */
function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]!))].sort();
}

const reference = flatten(load(DEFAULT_LOCALE));

describe("message files", () => {
  it("German uses Swiss spelling (no ß)", () => {
    const offenders = [...reference].filter(([, text]) => text.includes("ß"));
    expect(offenders).toEqual([]);
  });

  describe.each(LOCALES.filter((l) => l !== DEFAULT_LOCALE))("%s", (locale) => {
    const messages = flatten(load(locale));

    it("has exactly the keys of the German file", () => {
      const missing = [...reference.keys()].filter((k) => !messages.has(k));
      const extra = [...messages.keys()].filter((k) => !reference.has(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it("uses the same placeholders", () => {
      const mismatches = [...reference]
        .filter(([key]) => messages.has(key))
        .filter(
          ([key, text]) => placeholders(text).join() !== placeholders(messages.get(key)!).join(),
        )
        .map(([key]) => key);
      expect(mismatches).toEqual([]);
    });

    it("has no empty texts", () => {
      expect([...messages].filter(([, text]) => !text.trim()).map(([k]) => k)).toEqual([]);
    });
  });
});

describe("mergeMessages", () => {
  it("falls back to German for missing keys", () => {
    const merged = mergeMessages(
      { common: { save: "Speichern", cancel: "Abbrechen" } },
      { common: { save: "Enregistrer" } },
    );
    expect(merged).toEqual({ common: { save: "Enregistrer", cancel: "Abbrechen" } });
  });
});
