import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Difficulty } from "@/generated/prisma/enums";
import type { getBlockOptions } from "@/lib/blocks/queries";
import { BLOCK_SORTS, type BlockSearch, type BlockSort } from "@/lib/blocks/search-params";

type Options = Awaited<ReturnType<typeof getBlockOptions>>;

const selectClass =
  "border-input bg-background focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-3";

/**
 * A plain GET form: works without JavaScript, every state is a shareable
 * URL, and the server validates all parameters (blockSearchSchema).
 */
export async function BlockFilters({
  search,
  options,
  activeTeam,
  sort,
}: {
  search: BlockSearch;
  options: Options;
  activeTeam: { id: string; name: string } | null;
  sort: BlockSort;
}) {
  const t = await getTranslations();
  const filtersActive = Boolean(
    search.tags?.length ||
    search.section ||
    search.team ||
    search.durMin !== undefined ||
    search.durMax !== undefined ||
    search.difficulty ||
    search.age !== undefined ||
    search.coach,
  );
  const sectionName = (s: Options["sections"][number]) =>
    s.name ?? (s.builtin ? t(`sections.${s.builtin}`) : "");

  return (
    <form method="get" action="/blocks" role="search" className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <label htmlFor="block-search" className="sr-only">
          {t("blocks.searchLabel")}
        </label>
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
          />
          <Input
            id="block-search"
            type="search"
            name="q"
            defaultValue={search.q ?? ""}
            maxLength={100}
            placeholder={t("blocks.searchPlaceholder")}
            className="h-11 pl-10 text-base"
          />
        </div>
        <Button type="submit" className="h-11">
          {t("common.search")}
        </Button>
      </div>

      <details open={filtersActive} className="rounded-lg border">
        <summary className="hover:bg-accent flex min-h-11 cursor-pointer items-center gap-2 px-4 font-medium">
          <SlidersHorizontal aria-hidden className="size-4" />
          {t("blocks.filters")}
        </summary>
        <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium">
            {t("blocks.team")}
            <select name="team" defaultValue={search.team ?? ""} className={selectClass}>
              {activeTeam ? (
                <option value="">{t("blocks.activeTeam", { name: activeTeam.name })}</option>
              ) : (
                <option value="">{t("blocks.allTeams")}</option>
              )}
              {activeTeam ? <option value="all">{t("blocks.allTeams")}</option> : null}
              {options.teams
                .filter((x) => x.id !== activeTeam?.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t("blocks.section")}
            <select name="section" defaultValue={search.section ?? ""} className={selectClass}>
              <option value="">{t("blocks.anySection")}</option>
              {options.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {sectionName(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t("blocks.difficultyLabel")}
            <select
              name="difficulty"
              defaultValue={search.difficulty ?? ""}
              className={selectClass}
            >
              <option value="">{t("blocks.anyDifficulty")}</option>
              {Object.values(Difficulty).map((d) => (
                <option key={d} value={d}>
                  {t(`difficulty.${d}`)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">{t("blocks.durationRange")}</legend>
            <div className="flex items-center gap-2">
              <Input
                name="durMin"
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                defaultValue={search.durMin ?? ""}
                aria-label={`${t("blocks.durationRange")} ${t("common.from")}`}
                className="h-11 text-base"
              />
              <span aria-hidden>–</span>
              <Input
                name="durMax"
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                defaultValue={search.durMax ?? ""}
                aria-label={`${t("blocks.durationRange")} ${t("common.to")}`}
                className="h-11 text-base"
              />
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm font-medium">
            {t("blocks.age")}
            <Input
              name="age"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              defaultValue={search.age ?? ""}
              className="h-11 text-base"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t("blocks.coach")}
            <select name="coach" defaultValue={search.coach ?? ""} className={selectClass}>
              <option value="">{t("blocks.anyCoach")}</option>
              {options.coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {options.tags.length > 0 ? (
            <fieldset className="grid gap-1 sm:col-span-2 lg:col-span-3">
              <legend className="mb-1 text-sm font-medium">{t("blocks.tags")}</legend>
              <div className="flex flex-wrap gap-1">
                {options.tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="hover:bg-accent has-checked:bg-primary/10 has-checked:border-primary/40 flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="tags"
                      value={tag.id}
                      defaultChecked={search.tags?.includes(tag.id)}
                      className="size-4"
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label className="grid gap-1 text-sm font-medium">
            {t("blocks.sort")}
            <select name="sort" defaultValue={sort} className={selectClass}>
              {BLOCK_SORTS.filter((s) => s !== "relevance" || search.q).map((s) => (
                <option key={s} value={s}>
                  {t(`blocks.sorts.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2 lg:justify-end">
            <Button asChild variant="outline" className="h-11">
              <Link href="/blocks">{t("common.reset")}</Link>
            </Button>
            <Button type="submit" className="h-11">
              {t("common.apply")}
            </Button>
          </div>
        </div>
      </details>
    </form>
  );
}
