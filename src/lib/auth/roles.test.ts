import { describe, expect, it } from "vitest";
import { hasRole, permissionsFor } from "./roles";

describe("hasRole", () => {
  it("orders roles ADMIN > COACH > READER", () => {
    expect(hasRole("ADMIN", "COACH")).toBe(true);
    expect(hasRole("COACH", "COACH")).toBe(true);
    expect(hasRole("READER", "COACH")).toBe(false);
    expect(hasRole("COACH", "ADMIN")).toBe(false);
    expect(hasRole("READER", "READER")).toBe(true);
  });
});

describe("permissionsFor", () => {
  it("lets readers only export, within a quota", () => {
    expect(permissionsFor("READER")).toEqual({
      manageSettings: false,
      manageUsers: false,
      editLibrary: false,
      editLessons: false,
      sendEmail: false,
      exportPdf: true,
      pdfQuotaApplies: true,
    });
  });

  it("lets coaches edit and send but not administer", () => {
    const p = permissionsFor("COACH");
    expect(p.editLibrary && p.editLessons && p.sendEmail).toBe(true);
    expect(p.manageSettings || p.manageUsers || p.pdfQuotaApplies).toBe(false);
  });

  it("gives admins everything without a quota", () => {
    const p = permissionsFor("ADMIN");
    expect(Object.entries(p).every(([k, v]) => (k === "pdfQuotaApplies" ? !v : v))).toBe(true);
  });
});
