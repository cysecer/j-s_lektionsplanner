import { describe, expect, it } from "vitest";
import {
  blockSearchSchema,
  blockSearchToQuery,
  escapeLike,
  materialSuggestions,
  normalizeSearchParams,
} from "./search-params";

const uuid = (n: number) => `0192f0c1-7a3b-7c4d-8e5f-${String(n).padStart(12, "0")}`;

describe("blockSearchSchema", () => {
  it("parses valid parameters", () => {
    expect(
      blockSearchSchema.parse({
        q: "  Ball ",
        tags: `${uuid(1)},${uuid(2)},${uuid(1)}`,
        team: "all",
        durMin: "10",
        durMax: "30",
        difficulty: "EASY",
        age: "8",
        sort: "lastUsed",
        page: "2",
      }),
    ).toEqual({
      q: "Ball",
      tags: [uuid(1), uuid(2)],
      team: "all",
      durMin: 10,
      durMax: 30,
      difficulty: "EASY",
      age: 8,
      sort: "lastUsed",
      page: 2,
      section: undefined,
      kids: undefined,
      teamCount: undefined,
    });
  });

  it("drops invalid parameters individually instead of failing", () => {
    const parsed = blockSearchSchema.parse({
      q: "x".repeat(101),
      tags: "1; DROP TABLE x",
      team: "../admin",
      durMin: "-1",
      difficulty: "HARD",
      age: "abc",
      sort: "random()",
      page: "0",
      section: "Hauptteil",
    });
    expect(Object.values(parsed).every((v) => v === undefined)).toBe(true);
  });

  it("parses group size and team count, rejecting out-of-range values", () => {
    expect(blockSearchSchema.parse({ kids: "14", teamCount: "2" })).toMatchObject({
      kids: 14,
      teamCount: 2,
    });
    expect(blockSearchSchema.parse({ kids: "0", teamCount: "99" })).toMatchObject({
      kids: undefined,
      teamCount: undefined,
    });
  });

  it("no longer filters by responsible coach", () => {
    expect(blockSearchSchema.parse({ coach: uuid(1) })).not.toHaveProperty("coach");
  });

  it("ignores unknown parameters", () => {
    expect(blockSearchSchema.parse({ evil: "x" })).not.toHaveProperty("evil");
  });
});

describe("normalizeSearchParams", () => {
  it("joins repeated tags, keeps the first of other keys and drops empty fields", async () => {
    const normalized = await normalizeSearchParams(
      Promise.resolve({
        tags: [uuid(1), uuid(2)],
        q: ["a", "b"],
        durMax: "",
        age: " ",
        sort: "name",
      }),
    );
    expect(normalized).toEqual({ tags: `${uuid(1)},${uuid(2)}`, q: "a", sort: "name" });
    // An empty "duration to" must not turn into "at most 0 minutes".
    expect(blockSearchSchema.parse(normalized).durMax).toBeUndefined();
  });
});

describe("helpers", () => {
  it("builds query strings without empty values", () => {
    expect(blockSearchToQuery({ q: "Ball", tags: [uuid(1)], team: undefined, page: "" })).toBe(
      `q=Ball&tags=${uuid(1)}`,
    );
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });
});

describe("materialSuggestions", () => {
  it("drops quantities, merges duplicates and sorts", () => {
    expect(
      materialSuggestions([
        "4 Fussbälle",
        "Ca. 10 Matten",
        "fussbälle",
        "Keulen",
        "2-3 Softbälle",
        "Ev. Bändeli",
        "10 x Reifen",
        "5",
        "  ",
      ]),
    ).toEqual(["Bändeli", "Fussbälle", "Keulen", "Matten", "Reifen", "Softbälle"]);
  });

  it("keeps names that merely contain digits", () => {
    expect(materialSuggestions(["Ball Grösse 5"])).toEqual(["Ball Grösse 5"]);
  });
});

describe("material parameter", () => {
  it("is trimmed and limited", () => {
    expect(blockSearchSchema.parse({ material: "  Softbälle " }).material).toBe("Softbälle");
    expect(blockSearchSchema.parse({ material: "x".repeat(101) }).material).toBeUndefined();
    expect(blockSearchSchema.parse({ material: "   " }).material).toBeUndefined();
  });
});
