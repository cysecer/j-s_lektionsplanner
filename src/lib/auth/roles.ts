import type { Role } from "@/generated/prisma/enums";

const RANK: Record<Role, number> = { READER: 0, COACH: 1, ADMIN: 2 };

/** True if `role` grants at least the permissions of `minimum`. */
export function hasRole(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

/** What each role may do; the UI uses this to hide controls, the server enforces it. */
export function permissionsFor(role: Role) {
  return {
    manageSettings: role === "ADMIN",
    manageUsers: role === "ADMIN",
    editLibrary: hasRole(role, "COACH"),
    editLessons: hasRole(role, "COACH"),
    sendEmail: hasRole(role, "COACH"),
    exportPdf: true,
    /** Readers can export PDFs only within a daily quota. */
    pdfQuotaApplies: role === "READER",
  };
}

export type Permissions = ReturnType<typeof permissionsFor>;
