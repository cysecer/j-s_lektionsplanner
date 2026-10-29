import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AssetImage } from "@/components/asset-image";
import { PageHeader } from "@/components/page-header";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import type { getLesson } from "@/lib/lessons/queries";
import { computeLessonTiming, formatClockTime } from "@/lib/lessons/timing";
import type { RichText } from "@/lib/rich-text/schema";

type Lesson = NonNullable<Awaited<ReturnType<typeof getLesson>>>;

/**
 * Read-only view (readers). Phase 8 replaces the item rendering with the
 * configurable layout shared with the PDF.
 */
export async function LessonView({ lesson, locale }: { lesson: Lesson; locale: Locale }) {
  const t = await getTranslations();
  const sections = await db.section.findMany({
    where: { clubId: lesson.clubId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, builtin: true, name: true },
  });
  const timing = computeLessonTiming({
    startTimeMinutes: lesson.startTimeMinutes,
    plannedDurationMinutes: lesson.totalDurationMinutes,
    sections: sections.map((s) => ({
      id: s.id,
      items: lesson.items
        .filter((i) => i.sectionId === s.id)
        .map((i) => ({ id: i.id, durationMinutes: i.durationMinutes })),
    })),
  });

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <Button asChild variant="ghost" className="-ml-3 h-11 justify-self-start">
        <Link href="/lessons">
          <ArrowLeft aria-hidden />
          {t("lessons.back")}
        </Link>
      </Button>
      <PageHeader
        title={lesson.title}
        description={[formatDate(lesson.date, locale), lesson.team?.name, lesson.authorName]
          .filter(Boolean)
          .join(" · ")}
        actions={<Badge variant="secondary">{t(`lessons.status.${lesson.status}`)}</Badge>}
      />
      {[
        [t("lessons.general.goals"), lesson.goals],
        [t("lessons.general.notes"), lesson.notes],
        [t("lessons.general.safety"), lesson.safety],
      ].map(([label, value]) =>
        value ? (
          <section key={label as string} className="grid gap-1">
            <h2 className="font-semibold">{label as string}</h2>
            <RichTextView value={value as RichText} />
          </section>
        ) : null,
      )}
      {sections.map((section) => {
        const items = lesson.items.filter((i) => i.sectionId === section.id);
        const title = section.name ?? (section.builtin ? t(`sections.${section.builtin}`) : "");
        return (
          <section key={section.id} className="grid gap-2">
            <h2 className="border-b pb-1 text-sm font-semibold tracking-wider uppercase">
              {title}
            </h2>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("lessons.view.noItems")}</p>
            ) : (
              <ol className="grid gap-3">
                {items.map((item) => {
                  const clock = timing.items[item.id]?.startTimeMinutes ?? null;
                  const responsible = item.responsibleCoach?.name ?? item.responsibleText;
                  return (
                    <li
                      key={item.id}
                      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[5rem_1fr]"
                    >
                      <div className="tabular-nums">
                        {clock !== null ? (
                          <div className="font-medium">{formatClockTime(clock)}</div>
                        ) : null}
                        {item.durationMinutes !== null ? (
                          <div className="text-muted-foreground text-sm">
                            {t("units.minutesShort", { count: item.durationMinutes })}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <RichTextView value={item.description as RichText | null} />
                        <RichTextView value={item.rules as RichText | null} />
                        {item.variations.length > 0 ? (
                          <div>
                            <p className="text-sm font-medium">{t("blockFields.variations")}</p>
                            <ul className="list-disc pl-5">
                              {item.variations.map((v, i) => (
                                <li key={i}>{v}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <RichTextView
                          value={item.organization as RichText | null}
                          className="text-muted-foreground"
                        />
                        {item.sketches.map((s, i) => (
                          <AssetImage
                            key={s.assetId}
                            assetId={s.assetId}
                            alt={t("blocks.sketchAlt", { number: i + 1, title: item.title })}
                            className="max-h-64 rounded border object-contain"
                          />
                        ))}
                        {item.material.length > 0 ? (
                          <p className="text-sm">
                            <span className="font-medium">{t("blockFields.material")}: </span>
                            {item.material.join(", ")}
                          </p>
                        ) : null}
                        {responsible ? (
                          <p className="text-muted-foreground text-sm">
                            {t("lessons.items.responsible", { name: responsible })}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
