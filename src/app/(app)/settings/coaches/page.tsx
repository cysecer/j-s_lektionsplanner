import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { CoachesEditor } from "./coaches-editor";

export default async function CoachesSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations("settings.coaches");
  const [teams, coaches] = await Promise.all([
    db.team.findMany({
      where: { clubId: viewer.clubId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.coach.findMany({
      where: { clubId: viewer.clubId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        archivedAt: true,
        membership: { select: { id: true } },
        teams: { where: { team: { archivedAt: null } }, select: { teamId: true } },
      },
    }),
  ]);

  const rows = coaches.map((c) => ({
    id: c.id,
    name: c.name,
    archived: c.archivedAt !== null,
    hasAccount: c.membership !== null,
    teamIds: c.teams.map((x) => x.teamId),
  }));

  return (
    <div className="max-w-3xl">
      <SectionCard title={t("title")} description={t("intro")}>
        <CoachesEditor teams={teams} coaches={rows} />
      </SectionCard>
    </div>
  );
}
