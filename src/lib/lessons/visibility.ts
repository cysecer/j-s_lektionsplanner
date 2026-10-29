import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

type Who = { clubId: string; userId: string; role: Role };

/**
 * Which lessons someone may see. Teams with private drafts show a draft
 * only to its creator until it is published (status FINAL); admins see
 * everything. Lessons without team or without recorded creator stay
 * visible to all, as before this setting existed.
 *
 * Every lesson lookup on behalf of a person goes through this filter.
 */
export function visibleLessonsWhere(who: Who): Prisma.LessonWhereInput & { clubId: string } {
  if (who.role === "ADMIN") return { clubId: who.clubId };
  return {
    clubId: who.clubId,
    OR: [
      { status: "FINAL" },
      { createdById: who.userId },
      { createdById: null },
      { teamId: null },
      { team: { privateDrafts: false } },
    ],
  };
}
