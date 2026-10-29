import { describe, expect, it } from "vitest";
import {
  blockSearchSchema,
  blockSearchToQuery,
  escapeLike,
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
      coach: undefined,
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
