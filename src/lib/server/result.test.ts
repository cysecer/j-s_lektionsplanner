import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toFieldErrors } from "./result";

describe("toFieldErrors", () => {
  const schema = z.strictObject({
    email: z.email(),
    name: z.string().min(1).max(5),
    start: z.string().regex(/^\d\d:\d\d$/, { message: "validation.clockTime" }),
    nested: z.strictObject({ count: z.int() }),
  });

  it("maps issues to translation keys per field path", () => {
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
      name: ["validation.tooLong"],
      start: ["validation.clockTime"],
      "nested.count": ["validation.invalid"],
      _: ["validation.invalid"],
    });
  });

  it("reports missing values as required", () => {
    const result = schema.safeParse({});
    if (result.success) throw new Error("expected failure");
    expect(toFieldErrors(result.error).email).toEqual(["validation.required"]);
  });

  it("never passes through raw zod messages", () => {
    const result = z.strictObject({ a: z.literal("x") }).safeParse({ a: "<script>" });
    if (result.success) throw new Error("expected failure");
    for (const keys of Object.values(toFieldErrors(result.error))) {
      for (const key of keys) expect(key).toMatch(/^(validation|password)\./);
    }
  });
});
