import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import { SectionCard } from "@/components/settings/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/session";
import { getBlock, getBlockUsage } from "@/lib/blocks/queries";
import { db } from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/format";
import { richTextSchema, type RichText } from "@/lib/rich-text/schema";
import { parsePageInput } from "@/lib/server/params";
import { ageLabel, kidsLabel } from "../block-card";
import { BlockActions } from "./block-actions";
import { AssetImage } from "@/components/asset-image";

export default async function BlockPage({ params }: PageProps<"/blocks/[id]">) {
  const viewer = await requireViewer();
  const { id } = await parsePageInput(z.object({ id: z.uuid() }), params);
  const [block, usage, fields, t] = await Promise.all([
    getBlock(viewer.clubId, id),
    getBlockUsage(viewer.clubId, id),
    // Archived fields too: their values stay visible.
    db.customField.findMany({
      where: { clubId: viewer.clubId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, type: true },
    }),
    getTranslations(),
  ]);
  if (!block) notFound();

  const section = block.suggestedSection;
  const age = await ageLabel(block.ageMin, block.ageMax);
  const kids = await kidsLabel(block.minParticipants, block.maxParticipants);
  const customValues = (block.customValues ?? {}) as Record<string, unknown>;
  const facts: [string, string][] = [
    [
      t("blockFields.duration"),
      block.durationMinutes === null ? "" : t("units.minutes", { count: block.durationMinutes }),
    ],
    [
      t("blocks.section"),
      section ? (section.name ?? (section.builtin ? t(`sections.${section.builtin}`) : "")) : "",
    ],
    [t("blocks.difficultyLabel"), block.difficulty ? t(`difficulty.${block.difficulty}`) : ""],
    [t("blocks.age"), age ?? ""],
    [
      t("blockFields.teamCount"),
      block.teamCount === null ? "" : t("blocks.teamCount", { count: block.teamCount }),
    ],
    [t("blockFields.participants"), kids ?? ""],
    [
      t("blocks.team"),
      block.teams.length ? block.teams.map((x) => x.team.name).join(", ") : t("blocks.clubWide"),
    ],
  ];

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader
        title={block.title}
        actions={
          viewer.permissions.editLibrary ? (
            <>
              <Button asChild className="h-11">
                <Link href={`/blocks/${block.id}/edit`}>
                  <Pencil aria-hidden />
                  {t("common.edit")}
                </Link>
              </Button>
              <BlockActions id={block.id} title={block.title} />
            </>
          ) : null
        }
      />

      {block.tags.length > 0 ? (
        <p className="-mt-4 flex flex-wrap gap-1">
          {block.tags.map((x) => (
            <Badge key={x.tagId} variant="secondary">
              {x.tag.name}
            </Badge>
          ))}
        </p>
      ) : null}

      <dl className="grid gap-x-6 gap-y-3 rounded-xl border p-4 sm:grid-cols-3">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground text-sm">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="grid content-start gap-6">
          <Content
            title={t("blockFields.description")}
            value={block.description as RichText | null}
          />
          <Content title={t("blockFields.rules")} value={block.rules as RichText | null} />
          {block.variations.length > 0 ? (
            <section className="grid gap-2">
              <h2 className="text-lg font-semibold">{t("blockFields.variations")}</h2>
              <ul className="list-disc pl-5">
                {block.variations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {fields.map((field) => {
            const value = customValues[field.id];
            if (value === undefined || value === null) return null;
            return (
              <section key={field.id} className="grid gap-2">
                <h2 className="text-lg font-semibold">{field.label}</h2>
                <CustomValue type={field.type} value={value} label={field.label} />
              </section>
            );
          })}
        </div>
        <div className="grid content-start gap-6">
          <Content
            title={t("blockFields.organization")}
            value={block.organization as RichText | null}
          />
          {block.sketches.length > 0 ? (
            <section className="grid gap-2">
              <h2 className="text-lg font-semibold">{t("blockFields.sketches")}</h2>
              {block.sketches.map((s, i) => (
                <AssetImage
                  key={s.assetId}
                  assetId={s.assetId}
                  alt={t("blocks.sketchAlt", { number: i + 1, title: block.title })}
                  className="w-full rounded-lg border object-contain"
                />
              ))}
            </section>
          ) : null}
          {block.material.length > 0 ? (
            <section className="grid gap-2">
              <h2 className="text-lg font-semibold">{t("blockFields.material")}</h2>
              <ul className="list-disc pl-5">
                {block.material.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <SectionCard title={t("blocks.usedIn")}>
        {usage.length === 0 ? (
          <p className="text-muted-foreground">{t("blocks.usedInEmpty")}</p>
        ) : (
          <ul className="divide-y">
            {usage.map((lesson) => (
              <li
                key={lesson.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <Link
                  href={`/lessons/${lesson.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {lesson.title}
                </Link>
                <span className="text-muted-foreground text-sm">
                  {[
                    formatDate(lesson.date, viewer.locale),
                    lesson.team?.name,
                    lesson.items.some((i) => i.modifiedLocally)
                      ? t("blocks.modifiedLocally")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );

  function CustomValue({ type, value, label }: { type: string; value: unknown; label: string }) {
    if (type === "LONG_TEXT") {
      const doc = richTextSchema.safeParse(value);
      return doc.success ? <RichTextView value={doc.data} /> : null;
    }
    if (type === "LIST" && Array.isArray(value)) {
      return (
        <ul className="list-disc pl-5">
          {value.map((v, i) => (
            <li key={i}>{String(v)}</li>
          ))}
        </ul>
      );
    }
    if (type === "NUMBER" && typeof value === "number")
      return <p>{formatNumber(value, viewer.locale)}</p>;
    if (type === "IMAGE" && typeof value === "string") {
      return (
        <AssetImage
          assetId={value}
          alt={label}
          className="max-h-72 rounded-lg border object-contain"
        />
      );
    }
    return <p>{String(value)}</p>;
  }
}

function Content({ title, value }: { title: string; value: RichText | null }) {
  if (!value) return null;
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <RichTextView value={value} />
    </section>
  );
}
