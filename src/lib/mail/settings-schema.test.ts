import { describe, expect, it } from "vitest";
import { toFieldErrors } from "@/lib/server/result";
import { mailSettingsSchema, needsPasswordAgain } from "./settings-schema";

const valid = {
  host: "Mail.Example.ch",
  port: "587",
  security: "STARTTLS",
  username: "verein@example.ch",
  password: "",
  clearPassword: false,
  fromEmail: "Verein@Example.ch",
  fromName: "TV Muster",
};

function errors(input: object, allowInsecure = false) {
  const result = mailSettingsSchema(allowInsecure).safeParse({ ...valid, ...input });
  return result.success ? {} : toFieldErrors(result.error);
}

describe("mail settings schema", () => {
  it("normalises a valid form", () => {
    expect(mailSettingsSchema(false).parse(valid)).toEqual({
      ...valid,
      host: "mail.example.ch",
      port: 587,
      fromEmail: "verein@example.ch",
    });
    expect(mailSettingsSchema(false).parse({ ...valid, username: "", fromName: "" })).toMatchObject(
      { username: null, fromName: null },
    );
  });

  it("accepts IP addresses and refuses URLs or garbage as host", () => {
    expect(errors({ host: "10.0.0.5" })).toEqual({});
    expect(errors({ host: "::1" })).toEqual({});
    for (const host of [
      "smtp://mail.example.ch",
      "mail example",
      "a/b",
      "-x.ch",
      "x".repeat(254),
    ]) {
      expect(Object.keys(errors({ host })), host).toEqual(["host"]);
    }
  });

  it("only allows mail ports", () => {
    for (const port of ["25", "465", "587", "1025", "2525"]) expect(errors({ port })).toEqual({});
    for (const port of ["22", "80", "5432", "", "587.5", "x"]) {
      expect(errors({ port }).port, port).toEqual(["validation.smtpPort"]);
    }
  });

  it("refuses unencrypted connections unless explicitly allowed", () => {
    expect(errors({ security: "NONE" }).security).toEqual(["validation.smtpInsecure"]);
    expect(errors({ security: "NONE" }, true)).toEqual({});
  });

  it("refuses line breaks that could inject SMTP commands", () => {
    expect(errors({ username: "a\r\nRCPT TO:<x@y.z>" }).username).toEqual(["validation.invalid"]);
    expect(errors({ password: "pw\nQUIT" }).password).toEqual(["validation.invalid"]);
    expect(errors({ fromName: "A\nBcc: x@y.z" }).fromName).toEqual(["validation.invalid"]);
    expect(errors({ fromEmail: "a@b.ch\nBcc: x@y.z" }).fromEmail).toEqual(["validation.email"]);
  });

  it("rejects unknown keys", () => {
    expect(mailSettingsSchema(false).safeParse({ ...valid, passwordEncrypted: "x" }).success).toBe(
      false,
    );
  });
});

describe("needsPasswordAgain", () => {
  const stored = {
    host: "mail.example.ch",
    port: 587,
    security: "STARTTLS" as const,
    username: "u",
    hasPassword: true,
  };
  const next = { ...stored, password: "", clearPassword: false };

  it("keeps the password for the same server", () => {
    expect(needsPasswordAgain(stored, next)).toBe(false);
  });

  it("asks again when the server or account changes", () => {
    expect(needsPasswordAgain(stored, { ...next, host: "evil.example.com" })).toBe(true);
    expect(needsPasswordAgain(stored, { ...next, port: 25 })).toBe(true);
    expect(needsPasswordAgain(stored, { ...next, security: "TLS" })).toBe(true);
    expect(needsPasswordAgain(stored, { ...next, username: "other" })).toBe(true);
  });

  it("is satisfied by a new password, removing it, or no stored password", () => {
    const moved = { ...next, host: "other.example.ch" };
    expect(needsPasswordAgain(stored, { ...moved, password: "neu" })).toBe(false);
    expect(needsPasswordAgain(stored, { ...moved, clearPassword: true })).toBe(false);
    expect(needsPasswordAgain({ ...stored, hasPassword: false }, moved)).toBe(false);
    expect(needsPasswordAgain(null, moved)).toBe(false);
  });
});
