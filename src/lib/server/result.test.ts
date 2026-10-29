import { describe, expect, it } from "vitest";
import { z } from "zod";
import { blockInputSchema } from "@/lib/blocks/schema";
import { fieldErrorKey, toFieldErrors } from "./result";

describe("toFieldErrors", () => {
  const schema = z.strictObject({
    email: z.email(),
    name: z.string().min(1).max(5),
    start: z.string().regex(/^\d\d:\d\d$/, { message: "validation.clockTime" }),
    nested: z.strictObject({ count: z.int() }),
  });

  it("maps issues to translation keys per field path, with limits", () => {
    const result = schema.safeParse({
      email: "nope",
      name: "toolongname",
      start: "6pm",
      nested: { count: 1.5 },
      extra: true,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toFieldErrors(result.error)).toEqual({
      email: ["validation.email"],
      name: [{ key: "validation.tooLongMax", values: { max: 5 } }],
      start: ["validation.clockTime"],
      "nested.count": ["validation.invalid"],
      _: ["validation.invalid"],
    });
  });

  it("reports number limits with the actual bound", () => {
    const numbers = z.strictObject({ kids: z.number().min(1).max(500) });
    const tooBig = numbers.safeParse({ kids: 999 });
    const tooSmall = numbers.safeParse({ kids: 0 });
    if (tooBig.success || tooSmall.success) throw new Error("expected failure");
    expect(toFieldErrors(tooBig.error).kids).toEqual([
      { key: "validation.numberMax", values: { max: 500 } },
    ]);
    expect(toFieldErrors(tooSmall.error).kids).toEqual([
      { key: "validation.numberMin", values: { min: 1 } },
    ]);
  });

  it("looks inside unions ('empty or number') for the real problem", () => {
    // The case from practice: 999 as maximum number of kids.
    const result = blockInputSchema.safeParse({
      title: "Test",
      durationMinutes: "",
      description: null,
      rules: null,
      variations: [],
      organization: null,
      material: [],
      sketchAssetIds: [],
      tagIds: [],
      teamIds: [],
      suggestedSectionId: null,
      ageMin: "",
      ageMax: "",
      teamCount: "",
      minParticipants: "",
      maxParticipants: "999",
      difficulty: null,
      customValues: {},
    });
    if (result.success) throw new Error("expected failure");
    expect(toFieldErrors(result.error)).toEqual({
      maxParticipants: [{ key: "validation.numberMax", values: { max: 500 } }],
    });
  });

  it("asks for a whole number when decimals are not allowed", () => {
    const ints = z.strictObject({
      n: z.coerce.number().int({ message: "validation.wholeNumber" }),
    });
    const parsed = ints.safeParse({ n: "2.5" });
    if (parsed.success) throw new Error("expected failure");
    expect(toFieldErrors(parsed.error).n).toEqual(["validation.wholeNumber"]);
  });

  it("treats a required-but-empty text as required", () => {
    const result = z.strictObject({ title: z.string().trim().min(1) }).safeParse({ title: " " });
    if (result.success) throw new Error("expected failure");
    expect(toFieldErrors(result.error).title).toEqual(["validation.required"]);
  });

  it("reports missing values as required", () => {
    const result = schema.safeParse({});
    if (result.success) throw new Error("expected failure");
    expect(toFieldErrors(result.error).email).toEqual(["validation.required"]);
  });

  it("never passes through raw zod messages", () => {
    const result = z.strictObject({ a: z.literal("x") }).safeParse({ a: "<script>" });
    if (result.success) throw new Error("expected failure");
    for (const errors of Object.values(toFieldErrors(result.error))) {
      for (const error of errors) expect(fieldErrorKey(error)).toMatch(/^(validation|password)\./);
    }
  });
});
