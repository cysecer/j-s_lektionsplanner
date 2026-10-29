import { describe, expect, it } from "vitest";
import { actionErrorMessage, firstFieldError, translateKey } from "./i18n-keys";

// Minimal stand-in for next-intl's translator: returns the key it was asked for.
const known = new Set([
  "validation.required",
  "validation.invalid",
  "errorCodes.lastAdmin",
  "errors.validation",
]);
const t = Object.assign((key: string) => key, { has: (key: string) => known.has(key) }) as never;

describe("firstFieldError", () => {
  it("finds errors on the field itself", () => {
    expect(firstFieldError(t, { title: ["validation.required"] }, "title")).toBe(
      "validation.required",
    );
  });

  it("maps nested paths to their top-level field", () => {
    expect(
      firstFieldError(
        t,
        { "description.content.0.content": ["validation.invalid"] },
        "description",
      ),
    ).toBe("validation.invalid");
  });

  it("does not confuse fields sharing a prefix", () => {
    expect(firstFieldError(t, { ageMaxExtra: ["validation.invalid"] }, "ageMax")).toBeUndefined();
  });

  it("returns undefined without errors", () => {
    expect(firstFieldError(t, undefined, "title")).toBeUndefined();
  });
});

describe("translateKey / actionErrorMessage", () => {
  it("never shows unknown server strings verbatim", () => {
    expect(translateKey(t, "<script>")).toBe("validation.invalid");
    expect(translateKey(t, "validation.doesNotExist")).toBe("validation.invalid");
  });

  it("prefers a specific code over the generic error", () => {
    expect(actionErrorMessage(t, { error: "conflict", code: "lastAdmin" })).toBe(
      "errorCodes.lastAdmin",
    );
    expect(actionErrorMessage(t, { error: "validation", code: "bogus code" })).toBe(
      "errors.validation",
    );
  });
});
