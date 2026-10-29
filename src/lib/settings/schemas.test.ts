import { describe, expect, it } from "vitest";
import { toFieldErrors } from "@/lib/server/result";
import {
  clubSettingsSchema,
  coachSchema,
  customFieldUpdateSchema,
  displayName,
  accessSchema,
  invitePersonSchema,
  reorderSchema,
  sectionUpdateSchema,
  teamSchema,
} from "./schemas";

const uuid = (n: number) => `0192f0c1-7a3b-7c4d-8e5f-${String(n).padStart(12, "0")}`;

describe("displayName", () => {
  const name = displayName(10);
  it("trims and accepts ordinary names incl. umlauts", () => {
    expect(name.parse("  Zürich ")).toBe("Zürich");
    expect(name.parse(" Kids ")).toBe("Kids");
  });
  it.each([
    "",
    "   ",
    "a".repeat(11),
    `Kids${String.fromCharCode(0x0)}`, // NUL
    `Ki${String.fromCharCode(0xa)}ds`, // line break
    `Ki${String.fromCharCode(0x202e)}ds`, // right-to-left override
    `x${String.fromCharCode(0x2028)}y`, // line separator
    `a${String.fromCharCode(0x200b)}b`, // zero-width space
  ])("rejects %j", (value) => {
    expect(name.safeParse(value).success).toBe(false);
  });
});

describe("club settings", () => {
  it("parses clock time and duration", () => {
    expect(
      clubSettingsSchema.parse({
        name: "TV Musterdorf",
        pdfFooterText: "",
        defaultStartTime: "18:00",
        defaultDurationMinutes: "90",
        readerPdfDailyLimit: "0",
      }),
    ).toEqual({
      name: "TV Musterdorf",
      pdfFooterText: null,
      defaultStartTime: 1080,
      defaultDurationMinutes: 90,
      readerPdfDailyLimit: 0,
    });
  });

  it.each([
    { defaultStartTime: "25:00" },
    { defaultDurationMinutes: "0" },
    { defaultDurationMinutes: "1441" },
    { defaultDurationMinutes: "90.5" },
    { defaultDurationMinutes: "neunzig" },
    { readerPdfDailyLimit: "" },
    { readerPdfDailyLimit: "-1" },
    { readerPdfDailyLimit: "1001" },
    { readerPdfDailyLimit: "2.5" },
    { extra: "field" },
  ])("rejects %j", (patch) => {
    const base = {
      name: "TV",
      pdfFooterText: "",
      defaultStartTime: "18:00",
      defaultDurationMinutes: "90",
      readerPdfDailyLimit: "10",
    };
    expect(clubSettingsSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});

describe("team defaults are optional", () => {
  it("maps empty inputs to null", () => {
    expect(
      teamSchema.parse({
        name: "Jugi",
        defaultStartTime: "",
        defaultDurationMinutes: "",
        privateDrafts: false,
      }),
    ).toEqual({
      name: "Jugi",
      defaultStartTime: null,
      defaultDurationMinutes: null,
      privateDrafts: false,
    });
    expect(
      teamSchema.parse({
        name: "Jugi",
        defaultStartTime: "17:30",
        defaultDurationMinutes: 75,
        privateDrafts: true,
      }),
    ).toEqual({
      name: "Jugi",
      defaultStartTime: 1050,
      defaultDurationMinutes: 75,
      privateDrafts: true,
    });
  });
});

describe("lists of ids", () => {
  it("rejects duplicates and non-uuids", () => {
    expect(coachSchema.safeParse({ name: "A", teamIds: [uuid(1), uuid(1)] }).success).toBe(false);
    expect(coachSchema.safeParse({ name: "A", teamIds: ["1; DROP TABLE"] }).success).toBe(false);
    expect(reorderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(reorderSchema.safeParse({ ids: [uuid(1), uuid(2)] }).success).toBe(true);
  });
});

describe("other schemas", () => {
  it("lets built-in sections reset to the default name", () => {
    expect(sectionUpdateSchema.parse({ id: uuid(1), name: "" })).toEqual({
      id: uuid(1),
      name: null,
    });
  });

  it("never lets a custom field change its type", () => {
    expect(
      customFieldUpdateSchema.safeParse({
        id: uuid(1),
        label: "Quelle",
        searchable: true,
        filterable: false,
        type: "NUMBER",
      }).success,
    ).toBe(false);
  });

  it("normalises invitation emails", () => {
    expect(
      invitePersonSchema.parse({
        email: "Jan@Example.CH",
        access: { kind: "all", role: "COACH" },
        coachId: null,
        locale: "de-CH",
      }).email,
    ).toBe("jan@example.ch");
    expect(
      invitePersonSchema.safeParse({
        email: "x",
        access: { kind: "all", role: "OWNER" },
        coachId: null,
        locale: "de-CH",
      }).success,
    ).toBe(false);
  });

  it("validates access per team", () => {
    const parse = (access: unknown) => accessSchema.safeParse(access);
    expect(parse({ kind: "admin" }).success).toBe(true);
    expect(parse({ kind: "admin", role: "COACH" }).success).toBe(false);
    expect(parse({ kind: "all", role: "READER" }).success).toBe(true);
    expect(parse({ kind: "all", role: "ADMIN" }).success).toBe(false);
    expect(
      parse({
        kind: "teams",
        teams: [
          { teamId: uuid(1), role: "COACH" },
          { teamId: uuid(2), role: "READER" },
        ],
      }).success,
    ).toBe(true);
    const empty = parse({ kind: "teams", teams: [] });
    expect(empty.success || toFieldErrors(empty.error).teams).toEqual(["validation.teamsRequired"]);
    expect(
      parse({
        kind: "teams",
        teams: [
          { teamId: uuid(1), role: "COACH" },
          { teamId: uuid(1), role: "READER" },
        ],
      }).success,
    ).toBe(false);
    expect(parse({ kind: "teams", teams: [{ teamId: "kids", role: "COACH" }] }).success).toBe(
      false,
    );
  });
});
