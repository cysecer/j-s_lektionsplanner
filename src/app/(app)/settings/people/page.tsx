import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PeopleEditor } from "./people-editor";

export default async function PeopleSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations("settings.people");
  const [members, invitations, coaches] = await Promise.all([
    db.membership.findMany({
      where: { clubId: viewer.clubId },
      orderBy: { user: { name: "asc" } },
      select: {
        id: true,
        role: true,
        coachId: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.invitation.findMany({
      where: {
        clubId: viewer.clubId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
    db.coach.findMany({
      where: { clubId: viewer.clubId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, membership: { select: { id: true } } },
    }),
  ]);

  return (
    <div className="grid max-w-4xl gap-6">
      <SectionCard title={t("title")} description={t("intro")}>
        <PeopleEditor
          viewerUserId={viewer.userId}
          viewerLocale={viewer.locale}
          members={members.map((m) => ({
            membershipId: m.id,
            userId: m.user.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            coachId: m.coachId,
          }))}
          invitations={invitations.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            expires: formatDate(i.expiresAt, viewer.locale),
          }))}
          coaches={coaches.map((c) => ({
            id: c.id,
            name: c.name,
            linkedMembershipId: c.membership?.id ?? null,
          }))}
        />
      </SectionCard>
    </div>
  );
}
