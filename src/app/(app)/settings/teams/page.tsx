import { getTranslations } from "next-intl/server";
import { SectionCard } from "@/components/settings/section-card";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatTimeOfDay } from "@/lib/format";
import { TeamsEditor } from "./teams-editor";

export default async function TeamsSettingsPage() {
  const viewer = await requireViewer("ADMIN");
  const t = await getTranslations();
  const [club, teams] = await Promise.all([
    db.club.findUniqueOrThrow({
      where: { id: viewer.clubId },
      select: { defaultStartTimeMinutes: true, defaultDurationMinutes: true },
    }),
    db.team.findMany({
      where: { clubId: viewer.clubId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        archivedAt: true,
        defaultStartTimeMinutes: true,
        defaultDurationMinutes: true,
        privateDrafts: true,
      },
    }),
  ]);

  const toRow = (team: (typeof teams)[number]) => ({
    id: team.id,
    name: team.name,
    defaultStartTime:
      team.defaultStartTimeMinutes === null ? "" : formatTimeOfDay(team.defaultStartTimeMinutes),
    defaultDurationMinutes:
      team.defaultDurationMinutes === null ? "" : String(team.defaultDurationMinutes),
    privateDrafts: team.privateDrafts,
  });

  return (
    <div className="max-w-3xl">
      <SectionCard title={t("settings.teams.title")} description={t("settings.teams.intro")}>
        <TeamsEditor
          active={teams.filter((x) => !x.archivedAt).map(toRow)}
          archived={teams.filter((x) => x.archivedAt).map(toRow)}
          clubDefaults={{
            time: formatTimeOfDay(club.defaultStartTimeMinutes),
            duration: t("units.minutes", { count: club.defaultDurationMinutes }),
          }}
        />
      </SectionCard>
    </div>
  );
}
