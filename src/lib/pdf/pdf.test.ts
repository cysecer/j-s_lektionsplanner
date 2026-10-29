import { describe, expect, it } from "vitest";
import { startOfZurichDay } from "./day";
import { attachmentHeader, escapeHtml, pdfFileName } from "./filename";
import { createPrintToken, NonceRegistry, PRINT_TOKEN_TTL_MS, readPrintToken } from "./token";

const SECRET = "x".repeat(48);
const ids = {
  clubId: "0192f0c1-7a3b-7c4d-8e5f-000000000001",
  lessonId: "0192f0c1-7a3b-7c4d-8e5f-000000000002",
  layoutId: null,
};

describe("print token", () => {
  it("round-trips and is bound to its content", () => {
    const token = createPrintToken(SECRET, ids, 1000);
    expect(readPrintToken(SECRET, token, 1000)).toMatchObject(ids);
  });

  it("rejects other secrets, tampering, expiry and junk", () => {
    const token = createPrintToken(SECRET, ids, 1000);
    expect(readPrintToken("y".repeat(48), token, 1000)).toBeNull();
    const [data, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(data!, "base64url").toString()),
        lessonId: "0192f0c1-7a3b-7c4d-8e5f-000000000009",
      }),
    ).toString("base64url");
    expect(readPrintToken(SECRET, `${forged}.${sig}`, 1000)).toBeNull();
    expect(readPrintToken(SECRET, token, 1000 + PRINT_TOKEN_TTL_MS + 1)).toBeNull();
    for (const junk of ["", ".", "a.b.c", "x".repeat(3000), `${data}.`]) {
      expect(readPrintToken(SECRET, junk, 1000)).toBeNull();
    }
  });

  it("is usable once", () => {
    const registry = new NonceRegistry();
    const payload = readPrintToken(SECRET, createPrintToken(SECRET, ids, 1000), 1000)!;
    expect(registry.consume(payload.n, payload.exp, 1000)).toBe(true);
    expect(registry.consume(payload.n, payload.exp, 1001)).toBe(false);
  });
});

describe("pdf file name", () => {
  it("follows date_word_team_title", () => {
    expect(
      pdfFileName({
        date: "2018-11-28",
        word: "Lektionsvorbereitung",
        team: "Kids",
        title: "Spiele",
      }),
    ).toBe("2018-11-28_Lektionsvorbereitung_Kids_Spiele.pdf");
  });

  it("keeps umlauts, drops unsafe characters and the missing team", () => {
    expect(
      pdfFileName({
        date: "2026-10-29",
        word: "Lektionsvorbereitung",
        team: null,
        title: '../Bälle & "Spiele"/<b>',
      }),
    ).toBe("2026-10-29_Lektionsvorbereitung_Bälle-Spiele-b.pdf");
  });

  it("builds a safe attachment header with a UTF-8 name", () => {
    const header = attachmentHeader("2026-10-29_Lektionsvorbereitung_Bälle.pdf");
    expect(header).toContain('filename="2026-10-29_Lektionsvorbereitung_Balle.pdf"');
    expect(header).toContain("filename*=UTF-8''2026-10-29_Lektionsvorbereitung_B%C3%A4lle.pdf");
  });

  it("escapes footer text", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe(
      "&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;",
    );
  });
});

describe("startOfZurichDay", () => {
  it.each([
    // Winter (UTC+1)
    ["2026-01-15T10:00:00Z", "2026-01-14T23:00:00.000Z"],
    ["2026-01-15T23:30:00Z", "2026-01-15T23:00:00.000Z"],
    // Summer (UTC+2)
    ["2026-07-01T21:59:00Z", "2026-06-30T22:00:00.000Z"],
    ["2026-07-01T22:00:00Z", "2026-07-01T22:00:00.000Z"],
    // Day of the switch to summer time
    ["2026-03-29T12:00:00Z", "2026-03-28T23:00:00.000Z"],
  ])("%s → %s", (now, start) => {
    expect(startOfZurichDay(new Date(now)).toISOString()).toBe(start);
  });
});
