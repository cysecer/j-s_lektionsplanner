import { Plus, Library, SearchX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PasskeyNudgeSlot } from "@/components/auth/passkey-nudge-slot";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/session";
import { getBlockOptions, searchBlocks } from "@/lib/blocks/queries";
import {
  blockSearchSchema,
  blockSearchToQuery,
  normalizeSearchParams,
  type BlockSearch,
} from "@/lib/blocks/search-params";
import { db } from "@/lib/db";
import { parsePageInput } from "@/lib/server/params";
import { BlockCard } from "./block-card";
import { BlockFilters } from "./block-filters";

export default async function BlocksPage({ searchParams }: PageProps<"/blocks">) {
  const viewer = await requireViewer();
  const t = await getTranslations();
  const search = await parsePageInput(blockSearchSchema, normalizeSearchParams(searchParams), {});

  const options = await getBlockOptions(viewer.clubId);
  const activeTeam = options.teams.find((x) => x.id === viewer.activeTeamId) ?? null;
  const teamId = search.team === "all" ? null : (search.team ?? activeTeam?.id ?? null);
  const [result, totalInClub] = await Promise.all([
    searchBlocks(viewer.clubId, { ...search, teamId }),
    db.programBlock.count({ where: { clubId: viewer.clubId } }),
  ]);

  const pageHref = (page: number) =>
    `/blocks?${blockSearchToQuery({ ...search, page: page > 1 ? page : undefined } satisfies Partial<BlockSearch>)}`;

  return (
    <>
      <PasskeyNudgeSlot viewer={viewer} />
      <PageHeader
        title={t("blocks.title")}
        description={t("blocks.intro")}
        actions={
          viewer.permissions.editLibrary ? (
            <Button asChild className="h-11">
              <Link href="/blocks/new">
                <Plus aria-hidden />
                {t("blocks.new")}
              </Link>
            </Button>
          ) : null
        }
      />

      {totalInClub === 0 ? (
        <EmptyState
          icon={<Library />}
          title={t("blocks.emptyTitle")}
          description={t("blocks.emptyBody")}
          action={
            viewer.permissions.editLibrary ? (
              <Button asChild className="h-11">
                <Link href="/blocks/new">{t("blocks.new")}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6">
          <BlockFilters
            search={search}
            options={options}
            activeTeam={activeTeam}
            sort={result.sort}
          />

          <p className="text-muted-foreground text-sm" role="status">
            {t("blocks.results", { count: result.total })}
          </p>

          {result.items.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title={t("blocks.noResultsTitle")}
              description={t("blocks.noResultsBody")}
              action={
                <Button asChild variant="outline" className="h-11">
                  <Link href="/blocks">{t("common.reset")}</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((block) => (
                <li key={block.id}>
                  <BlockCard block={block} locale={viewer.locale} />
                </li>
              ))}
            </ul>
          )}

          {result.pageCount > 1 ? (
            <nav
              className="flex items-center justify-between gap-2"
              aria-label={t("blocks.pageOf", { page: result.page, pages: result.pageCount })}
            >
              <Button asChild variant="outline" className="h-11" aria-disabled={result.page <= 1}>
                <Link href={pageHref(Math.max(1, result.page - 1))}>{t("common.previous")}</Link>
              </Button>
              <span className="text-muted-foreground text-sm">
                {t("blocks.pageOf", { page: result.page, pages: result.pageCount })}
              </span>
              <Button
                asChild
                variant="outline"
                className="h-11"
                aria-disabled={result.page >= result.pageCount}
              >
                <Link href={pageHref(Math.min(result.pageCount, result.page + 1))}>
                  {t("common.next")}
                </Link>
              </Button>
            </nav>
          ) : null}
        </div>
      )}
    </>
  );
}
