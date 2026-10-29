import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./secret-box";

const KEY = "k".repeat(48);

describe("secret box", () => {
  it("round-trips and never contains the plaintext", () => {
    const sealed = sealSecret(KEY, "smtp", "club-1", "geheimes Passwort");
    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sealed).not.toContain("geheim");
    expect(openSecret(KEY, "smtp", "club-1", sealed)).toBe("geheimes Passwort");
  });

  it("uses a fresh IV every time", () => {
    expect(sealSecret(KEY, "smtp", "c", "x")).not.toBe(sealSecret(KEY, "smtp", "c", "x"));
  });

  it("refuses another key, purpose or context", () => {
    const sealed = sealSecret(KEY, "smtp", "club-1", "pw");
    expect(openSecret("o".repeat(48), "smtp", "club-1", sealed)).toBeNull();
    expect(openSecret(KEY, "other", "club-1", sealed)).toBeNull();
    expect(openSecret(KEY, "smtp", "club-2", sealed)).toBeNull();
  });

  it("refuses tampered or malformed values", () => {
    const sealed = sealSecret(KEY, "smtp", "c", "pw");
    const [v, iv, tag, data] = sealed.split(".");
    const flipped = data!.startsWith("A") ? `B${data!.slice(1)}` : `A${data!.slice(1)}`;
    expect(openSecret(KEY, "smtp", "c", [v, iv, tag, flipped].join("."))).toBeNull();
    for (const bad of ["", "v1", "v2.a.b.c", "v1.a.b.c", "v1...", sealed + ".x"]) {
      expect(openSecret(KEY, "smtp", "c", bad)).toBeNull();
    }
  });
});
