import { Clock, ImageIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import type { BlockListItem } from "@/lib/blocks/queries";
import { formatDate } from "@/lib/format";
import { AssetImage } from "@/components/asset-image";

export async function ageLabel(min: number | null, max: number | null) {
  const t = await getTranslations("blocks");
  if (min !== null && max !== null) return t("ageRange", { min, max });
  if (min !== null) return t("ageFrom", { min });
  if (max !== null) return t("ageTo", { max });
  return null;
}

export async function BlockCard({ block, locale }: { block: BlockListItem; locale: Locale }) {
  const t = await getTranslations();
  const section = block.suggestedSection;
  const sectionLabel = section
    ? (section.name ?? (section.builtin ? t(`sections.${section.builtin}`) : null))
    : null;
  const age = await ageLabel(block.ageMin, block.ageMax);

  return (
    <Link
      href={`/blocks/${block.id}`}
      className="hover:border-primary/40 focus-visible:ring-ring/50 group flex h-full flex-col overflow-hidden rounded-xl border outline-none focus-visible:ring-3"
    >
      <div className="bg-muted/40 flex aspect-[16/9] items-center justify-center border-b">
        {block.thumbnailAssetId ? (
          <AssetImage
            assetId={block.thumbnailAssetId}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <ImageIcon aria-hidden className="text-muted-foreground/40 size-8" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold group-hover:underline">{block.title}</h2>
          {block.durationMinutes !== null ? (
            <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm">
              <Clock aria-hidden className="size-4" />
              {t("units.minutesShort", { count: block.durationMinutes })}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          {[sectionLabel, block.difficulty ? t(`difficulty.${block.difficulty}`) : null, age]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {block.tags.length > 0 ? (
          <p className="flex flex-wrap gap-1">
            {block.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-auto pt-2 text-xs">
          {block.teams.length > 0
            ? block.teams.map((x) => x.name).join(", ")
            : t("blocks.clubWide")}
          {" · "}
          {t("blocks.usage", { count: block.useCount })}
          {block.lastUsed
            ? ` · ${t("blocks.lastUsed", { date: formatDate(block.lastUsed, locale) })}`
            : ""}
        </p>
      </div>
    </Link>
  );
}
