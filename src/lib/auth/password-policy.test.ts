import { describe, expect, it } from "vitest";
import { checkPassword, passwordContext, passwordLength } from "./password-policy";

const blocklist = new Set(["harrypotterharrypotter", "ilovemyfamilyforever"]);
const context = passwordContext({
  email: "andrea.keller@tv-musterdorf.ch",
  name: "Andrea Keller",
  clubName: "TV Musterdorf",
});
const check = (p: string) => checkPassword(p, { blocklist, context });

describe("checkPassword", () => {
  it("accepts a long passphrase without composition rules", () => {
    expect(check("velo fahren am sonntag morgen")).toBeNull();
    expect(check("keulenfussballistlustig")).toBeNull();
  });

  it("accepts Unicode and spaces", () => {
    expect(check("Grüezi mitenand im Turnverein")).toBeNull();
    expect(check("🦒🦒 giraffe läuft über 🐘")).toBeNull();
  });

  it("enforces 15 to 128 characters (code points)", () => {
    expect(check("a".repeat(5) + "bcdefghij")).toBe("tooShort");
    expect(check("x7Fq!pL0zR#2mW9v".slice(0, 15))).toBeNull();
    expect(check("ab".repeat(64) + "c")).toBe("tooLong");
  });

  it("counts emoji as single characters", () => {
    expect(passwordLength("🦒".repeat(15))).toBe(15);
  });

  it("rejects blocklisted passwords case-insensitively and ignoring spaces", () => {
    expect(check("HarryPotterHarryPotter")).toBe("common");
    expect(check("I love my family forever")).toBe("common");
  });

  it("rejects repetitive and sequential passwords", () => {
    expect(check("aaaaaaaaaaaaaaaaaa")).toBe("repetitive");
    expect(check("abcabcabcabcabcabc")).toBe("repetitive");
    expect(check("abcdefghijklmnopq")).toBe("sequential");
    expect(check("zyxwvutsrqponmlk")).toBe("sequential");
  });

  it("rejects passwords built around context words", () => {
    expect(check("andrea.keller@tv-musterdorf.ch")).toBe("contextual");
    expect(check("Lektionsplaner2024!")).toBe("contextual");
    expect(check("tvmusterdorf12345")).toBe("contextual");
    // Several context words together, each one alone would leave a long rest.
    expect(check("andrea keller lektionsplaner")).toBe("contextual");
    expect(check("Keller Andrea Musterdorf 2024")).toBe("contextual");
  });

  it("allows a context word inside an otherwise strong passphrase", () => {
    expect(check("andrea mag gelbe velos und berge")).toBeNull();
  });
});
