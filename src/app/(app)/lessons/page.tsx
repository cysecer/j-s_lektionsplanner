import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PasskeyNudgeSlot } from "@/components/auth/passkey-nudge-slot";
import { DateField } from "@/components/date-time-fields";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORMAT_LOCALE } from "@/i18n/config";
import { requireViewer } from "@/lib/auth/session";
import { formatDateInput, weekdayShort } from "@/lib/date-input";
import { db } from "@/lib/db";
import { formatTimeOfDay, toIsoDate } from "@/lib/format";
import { listLessons } from "@/lib/lessons/queries";
import { parsePageInput } from "@/lib/server/params";
import { cn } from "@/lib/utils";
import { LessonList } from "./lesson-list";
import { NewLessonButton } from "./new-lesson-button";

const searchSchema = z.object({
  team: z
    .union([z.literal("all"), z.uuid()])
    .optional()
    .catch(undefined),
  when: z.enum(["upcoming", "past"]).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

const selectClass =
  "border-input bg-background focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm";

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
  const when = search.when ?? "upcoming";
  const page = search.page ?? 1;
  const q = search.q || undefined;
  const { lessons, counts, total, pageCount } = await listLessons(viewer, {
    teamId,
    when,
    q,
    from: search.from,
    to: search.to,
    page,
  });
  const filtered = Boolean(q || search.from || search.to);

  const href = (patch: { when?: "upcoming" | "past"; page?: number }) => {
    const params = new URLSearchParams();
    if (search.team) params.set("team", search.team);
    if (q) params.set("q", q);
    if (search.from) params.set("from", search.from);
    if (search.to) params.set("to", search.to);
    const nextWhen = patch.when ?? when;
    if (nextWhen !== "upcoming") params.set("when", nextWhen);
    const nextPage = patch.page ?? 1;
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/lessons?${params}`;
  };

  const rows = lessons.map((lesson) => {
    const iso = toIsoDate(lesson.date);
    return {
      id: lesson.id,
      title: lesson.title,
      date: `${weekdayShort(iso, FORMAT_LOCALE[viewer.locale])} ${formatDateInput(iso)}`,
      time: lesson.startTimeMinutes === null ? null : formatTimeOfDay(lesson.startTimeMinutes),
      meta: [
        lesson.team?.name,
        t("lessons.itemsCount", { count: lesson.itemCount }),
        lesson.plannedMinutes ? t("units.minutes", { count: lesson.plannedMinutes }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      createdByName: lesson.createdByName,
      status: lesson.status,
    };
  });

  return (
    <>
      <PasskeyNudgeSlot viewer={viewer} />
      <PageHeader
        title={t("lessons.title")}
        description={t("lessons.intro")}
        actions={viewer.permissions.editLessons ? <NewLessonButton /> : null}
      />

      <form
        // Remount on navigation so the fields show the current filter
        // (e.g. after "Zurücksetzen"), not what was typed before.
        key={JSON.stringify([search.team, q, search.from, search.to, when])}
        method="get"
        action="/lessons"
        role="search"
        className="mb-6 grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.3fr_auto] lg:items-end"
      >
        {when !== "upcoming" ? <input type="hidden" name="when" value={when} /> : null}
        <div className="grid gap-2">
          <Label htmlFor="lesson-filter-q">{t("lessons.filter.q")}</Label>
          <Input
            id="lesson-filter-q"
            type="search"
            name="q"
            defaultValue={q ?? ""}
            maxLength={100}
            placeholder={t("lessons.filter.qPlaceholder")}
            className="h-11 text-base"
          />
        </div>
        <DateField label={t("lessons.filter.from")} name="from" value={search.from ?? ""} />
        <DateField label={t("lessons.filter.to")} name="to" value={search.to ?? ""} />
        <div className="grid gap-2">
          <Label htmlFor="lesson-filter-team">{t("blocks.team")}</Label>
          <select
            id="lesson-filter-team"
            name="team"
            defaultValue={search.team ?? ""}
            className={selectClass}
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
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-11">
            {t("common.apply")}
          </Button>
          {filtered ? (
            <Button asChild variant="ghost" className="h-11">
              <Link href={when === "past" ? "/lessons?when=past" : "/lessons"}>
                {t("lessons.filter.reset")}
              </Link>
            </Button>
          ) : null}
        </div>
      </form>

      <nav aria-label={t("lessons.tabs.label")} className="mb-4 border-b">
        <ul className="flex gap-1">
          {(["upcoming", "past"] as const).map((tab) => (
            <li key={tab}>
              <Link
                href={href({ when: tab })}
                aria-current={when === tab ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-11 items-center border-b-2 px-3 text-sm font-medium",
                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                  when === tab
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {t(`lessons.tabs.${tab}`, { count: counts[tab] })}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="text-muted-foreground mb-3 text-sm" role="status">
        {t("lessons.results", { count: total })}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={
            filtered
              ? t("lessons.emptyFiltered")
              : when === "upcoming"
                ? t("lessons.emptyUpcoming")
                : t("lessons.emptyTitle")
          }
          description={filtered || counts.past > 0 ? undefined : t("lessons.emptyBody")}
          action={
            when === "upcoming" && counts.past > 0 ? (
              <Button asChild variant="outline" className="h-11">
                <Link href={href({ when: "past" })}>
                  {t("lessons.showPast", { count: counts.past })}
                </Link>
              </Button>
            ) : viewer.permissions.editLessons && !filtered ? (
              <NewLessonButton />
            ) : undefined
          }
        />
      ) : (
        <LessonList
          lessons={rows}
          canDelete={viewer.permissions.editLessons}
          canSelect={viewer.role === "ADMIN"}
        />
      )}

      {pageCount > 1 ? (
        <nav
          className="mt-4 flex items-center justify-between gap-2"
          aria-label={t("blocks.pageOf", { page, pages: pageCount })}
        >
          <Button asChild variant="outline" className="h-11">
            <Link href={href({ page: Math.max(1, page - 1) })}>{t("common.previous")}</Link>
          </Button>
          <span className="text-muted-foreground text-sm">
            {t("blocks.pageOf", { page, pages: pageCount })}
          </span>
          <Button asChild variant="outline" className="h-11">
            <Link href={href({ page: Math.min(pageCount, page + 1) })}>{t("common.next")}</Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}
