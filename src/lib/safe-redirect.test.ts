import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/", "/lessons", "/lessons/abc?tab=items", "/blocks#top"])("keeps %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "lessons",
    "/a b",
    "",
    null,
    42,
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/");
  });
});
