import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PasskeyNudgeSlot } from "@/components/auth/passkey-nudge-slot";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { listLessons } from "@/lib/lessons/queries";
import { parsePageInput } from "@/lib/server/params";
import { NewLessonButton } from "./new-lesson-button";

const searchSchema = z.object({
  team: z
    .union([z.literal("all"), z.uuid()])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function LessonsPage({ searchParams }: PageProps<"/lessons">) {
  const viewer = await requireViewer();
  const t = await getTranslations();
  const search = await parsePageInput(searchSchema, searchParams, {});
  const teams = await db.team.findMany({
    where: { clubId: viewer.clubId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const activeTeam = teams.find((x) => x.id === viewer.activeTeamId) ?? null;
  const teamId = search.team === "all" ? null : (search.team ?? activeTeam?.id ?? null);
  const page = search.page ?? 1;
  const { lessons, total, pageCount } = await listLessons(viewer.clubId, { teamId, page });
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (search.team) params.set("team", search.team);
    if (p > 1) params.set("page", String(p));
    return `/lessons?${params}`;
  };

  return (
    <>
      <PasskeyNudgeSlot viewer={viewer} />
      <PageHeader
        title={t("lessons.title")}
        description={t("lessons.intro")}
        actions={viewer.permissions.editLessons ? <NewLessonButton /> : null}
      />

      <form method="get" action="/lessons" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-medium">
          {t("blocks.team")}
          <select
            name="team"
            defaultValue={search.team ?? ""}
            className="border-input bg-background focus-visible:ring-ring/50 h-11 min-w-56 rounded-lg border px-3 text-base outline-none focus-visible:ring-3"
          >
            <option value="">
              {activeTeam
                ? t("blocks.activeTeam", { name: activeTeam.name })
                : t("blocks.allTeams")}
            </option>
            {activeTeam ? <option value="all">{t("blocks.allTeams")}</option> : null}
            {teams
              .filter((x) => x.id !== activeTeam?.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="h-11">
          {t("common.apply")}
        </Button>
      </form>

      <p className="text-muted-foreground mb-3 text-sm" role="status">
        {t("lessons.results", { count: total })}
      </p>

      {lessons.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={t("lessons.emptyTitle")}
          description={t("lessons.emptyBody")}
          action={viewer.permissions.editLessons ? <NewLessonButton /> : undefined}
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/lessons/${lesson.id}`}
                className="hover:bg-accent/50 focus-visible:ring-ring/50 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 outline-none focus-visible:ring-3"
              >
                <span className="text-muted-foreground w-24 shrink-0 tabular-nums">
                  {formatDate(lesson.date, viewer.locale)}
                </span>
                <span className="min-w-40 flex-1 font-medium">{lesson.title}</span>
                <span className="text-muted-foreground text-sm">
                  {[
                    lesson.team?.name,
                    t("lessons.itemsCount", { count: lesson.itemCount }),
                    lesson.plannedMinutes
                      ? t("units.minutes", { count: lesson.plannedMinutes })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <Badge variant={lesson.status === "FINAL" ? "default" : "secondary"}>
                  {t(`lessons.status.${lesson.status}`)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          className="mt-4 flex items-center justify-between gap-2"
          aria-label={t("blocks.pageOf", { page, pages: pageCount })}
        >
          <Button asChild variant="outline" className="h-11">
            <Link href={pageHref(Math.max(1, page - 1))}>{t("common.previous")}</Link>
          </Button>
          <span className="text-muted-foreground text-sm">
            {t("blocks.pageOf", { page, pages: pageCount })}
          </span>
          <Button asChild variant="outline" className="h-11">
            <Link href={pageHref(Math.min(pageCount, page + 1))}>{t("common.next")}</Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}
