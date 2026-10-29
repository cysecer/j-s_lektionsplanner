import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AssetImage } from "@/components/asset-image";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import { Difficulty } from "@/generated/prisma/enums";
import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/lib/format";
import type {
  BuiltinField,
  ConditionField,
  LayoutColumn,
  LayoutConfig,
  LayoutFieldRef,
  TextSize,
} from "@/lib/layout/schema";
import type { DocumentClub, LessonDocument, LessonDocumentItem } from "@/lib/lessons/document";
import { formatClockTime } from "@/lib/lessons/timing";
import { richTextSchema, type RichText } from "@/lib/rich-text/schema";
import { cn } from "@/lib/utils";

const FONT_SIZE: Record<TextSize, string> = { small: "8.5pt", medium: "10pt", large: "11.5pt" };

/**
 * The lesson as a document, laid out by a layout config. Rendered on screen
 * (read view, layout preview) and printed to PDF, so it is always light,
 * table-based like the paper Lektionsvorbereitung, and has no interactivity.
 * Works in server and client components.
 */
export function LessonDocumentView({
  document: doc,
  layout,
  club,
  className,
}: {
  document: LessonDocument;
  layout: LayoutConfig;
  club: DocumentClub;
  className?: string;
}) {
  const t = useTranslations("document");
  const locale = useLocale() as Locale;
  const settings = layout.document;

  return (
    <article
      className={cn("lesson-document grid gap-[1.2em] bg-white text-black", className)}
      style={{ fontSize: FONT_SIZE[settings.textSize] }}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="grid gap-[0.4em]">
          <p className="text-[1.6em] font-bold">{club.name}</p>
          <p>
            <span>{t("lessonTitle")}: </span>
            <span className="text-[1.4em] font-bold">{doc.title}</span>
          </p>
          <p>
            <span className="font-bold">{t("author")}: </span>
            {doc.authorName}
            <span className="ml-[2em]">{formatDate(new Date(doc.date), locale)}</span>
            {doc.teamName ? <span className="ml-[2em]">{doc.teamName}</span> : null}
          </p>
        </div>
        {settings.showLogo && club.logoAssetId ? (
          <AssetImage
            assetId={club.logoAssetId}
            alt={club.name}
            className="max-h-[6em] max-w-[12em] object-contain"
          />
        ) : null}
      </header>

      {settings.conditions.length > 0 ? (
        <section className="grid gap-[0.4em]">
          <h2 className="font-bold">{t("conditions")}</h2>
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-1/5" />
              <col />
            </colgroup>
            <tbody>
              {settings.conditions.map((field) => (
                <tr key={field} className="break-inside-avoid">
                  <th scope="row" className={cn(cellClass, "text-left font-normal")}>
                    {t(`conditionLabels.${field}`)}:
                  </th>
                  <td className={cellClass}>
                    <ConditionValue field={field} doc={doc} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {settings.boxes.map((box) => (
        <section key={box} className="grid break-inside-avoid gap-[0.4em]">
          <h2 className="font-bold">{t(`boxes.${box}`)}:</h2>
          <div className={cn(cellClass, "min-h-[2.5em]")}>
            <RichTextView value={doc[box]} />
          </div>
        </section>
      ))}

      <section className="grid gap-[0.8em]">
        <h2 className="font-bold">{t("contents")}:</h2>
        {doc.sections.map((section) => (
          <SectionTable
            key={section.id}
            title={section.title}
            items={section.items}
            columns={layout.columns}
            club={club}
          />
        ))}
      </section>

      {club.footerText ? (
        <footer className="lesson-document-footer border-t pt-[0.4em] text-[0.85em]">
          {club.footerText}
        </footer>
      ) : null}
    </article>
  );
}

const cellClass = "border border-black/60 px-[0.5em] py-[0.3em] align-top";

function SectionTable({
  title,
  items,
  columns,
  club,
}: {
  title: string;
  items: LessonDocumentItem[];
  columns: LayoutColumn[];
  club: DocumentClub;
}) {
  const t = useTranslations("document");
  const total = columns.reduce((sum, c) => sum + c.width, 0);
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        {columns.map((c) => (
          <col key={c.id} style={{ width: `${(c.width / total) * 100}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th
            scope="colgroup"
            colSpan={columns.length}
            className={cn(cellClass, "bg-black/10 text-left font-bold uppercase")}
          >
            {title}
          </th>
        </tr>
        <tr>
          {columns.map((c) => (
            <th key={c.id} scope="col" className={cn(cellClass, "text-left font-bold")}>
              {c.label ?? (c.labelKey ? t(`columns.${c.labelKey}`) : "")}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className={cn(cellClass, "h-[2.5em]")}>
              <span className="sr-only">{t("noItems")}</span>
            </td>
          </tr>
        ) : (
          items.map((item) => (
            <tr key={item.id} className="break-inside-avoid">
              {columns.map((c) => (
                <td key={c.id} className={cellClass}>
                  <div className="grid gap-[0.5em]">
                    {c.fields.map((f) => (
                      <FieldValue
                        key={f.field}
                        field={f.field}
                        showLabel={f.showLabel}
                        item={item}
                        club={club}
                      />
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ConditionValue({ field, doc }: { field: ConditionField; doc: LessonDocument }) {
  const t = useTranslations();
  switch (field) {
    case "totalDuration":
      return doc.totalDurationMinutes !== null
        ? t("units.minutes", { count: doc.totalDurationMinutes })
        : null;
    case "startTime":
      return doc.startTimeMinutes !== null ? formatClockTime(doc.startTimeMinutes) : null;
    case "difficulty":
      // Like the paper form: all levels, the chosen one marked.
      return (
        <span className="flex flex-wrap gap-x-[1.5em]">
          {Object.values(Difficulty).map((d) =>
            d === doc.difficulty ? (
              <strong key={d} className="underline underline-offset-2">
                {t(`difficulty.${d}`)}
              </strong>
            ) : (
              <span key={d} className="text-black/45" aria-hidden={doc.difficulty !== null}>
                {t(`difficulty.${d}`)}
              </span>
            ),
          )}
        </span>
      );
    case "age":
      return rangeText(t, "age", doc.ageMin, doc.ageMax);
    case "groupSize":
      return doc.groupSize;
    case "location":
      return doc.location;
    case "team":
      return doc.teamName;
    case "presentCoaches":
      return doc.presentCoaches.join(", ");
    case "safety":
      return <RichTextView value={doc.safety} />;
  }
}

type T = ReturnType<typeof useTranslations<never>>;

function rangeText(t: T, kind: "age" | "kids", min: number | null, max: number | null) {
  if (kind === "age") {
    if (min !== null && max !== null) return t("blocks.ageRange", { min, max });
    if (min !== null) return t("blocks.ageFrom", { min });
    if (max !== null) return t("blocks.ageTo", { max });
    return null;
  }
  if (min !== null && max !== null) return t("blocks.kidsRange", { min, max });
  if (min !== null) return t("blocks.kidsFrom", { min });
  if (max !== null) return t("blocks.kidsTo", { max });
  return null;
}

function FieldValue({
  field,
  showLabel,
  item,
  club,
}: {
  field: LayoutFieldRef;
  showLabel: boolean;
  item: LessonDocumentItem;
  club: DocumentClub;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  if (field.startsWith("custom:")) {
    const def = club.fields.find((f) => `custom:${f.id}` === field);
    const value = def ? item.customValues[def.id] : undefined;
    if (!def || value === undefined || value === null || value === "") return null;
    return (
      <Labeled
        label={showLabel ? def.label : null}
        block={def.type === "LONG_TEXT" || def.type === "LIST" || def.type === "IMAGE"}
      >
        <CustomValue type={def.type} value={value} label={def.label} locale={locale} />
      </Labeled>
    );
  }

  const label = showLabel ? t(`blockFields.${field as BuiltinField}`) : null;
  switch (field) {
    case "startTime":
      return item.startTimeMinutes !== null ? (
        <Labeled label={label}>
          <span className="font-bold tabular-nums">{formatClockTime(item.startTimeMinutes)}</span>
        </Labeled>
      ) : null;
    case "duration":
      return item.durationMinutes !== null ? (
        <Labeled label={label}>
          <span className="tabular-nums">
            {t("units.minutesShort", { count: item.durationMinutes })}
          </span>
        </Labeled>
      ) : null;
    case "title":
      return (
        <Labeled label={label}>
          <span className="font-bold">{item.title}</span>
        </Labeled>
      );
    case "description":
    case "rules":
    case "organization":
      return item[field] ? (
        <Labeled label={label} block>
          <RichTextView value={item[field]} />
        </Labeled>
      ) : null;
    case "variations":
      return item.variations.length > 0 ? (
        <Labeled label={label} block>
          <ul className="list-disc pl-[1.2em]">
            {item.variations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </Labeled>
      ) : null;
    case "sketches":
      return item.sketchAssetIds.length > 0 ? (
        <Labeled label={label} block>
          {item.sketchAssetIds.map((id, i) => (
            <AssetImage
              key={id}
              assetId={id}
              alt={t("blocks.sketchAlt", { number: i + 1, title: item.title })}
              className="max-h-[16em] w-full object-contain"
            />
          ))}
        </Labeled>
      ) : null;
    case "material":
      return item.material.length > 0 ? (
        <Labeled label={label} block>
          {item.material.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
        </Labeled>
      ) : null;
    case "responsible":
      return item.responsible ? <Labeled label={label}>{item.responsible}</Labeled> : null;
    case "teamCount":
      return item.teamCount !== null ? (
        <Labeled label={label}>{t("blocks.teamCount", { count: item.teamCount })}</Labeled>
      ) : null;
    case "participants": {
      const text = rangeText(t, "kids", item.minParticipants, item.maxParticipants);
      return text ? <Labeled label={label}>{text}</Labeled> : null;
    }
    default:
      return null;
  }
}

/** Optional label: on its own line before longer content, inline before short values. */
function Labeled({
  label,
  block,
  children,
}: {
  label: string | null;
  block?: boolean;
  children: ReactNode;
}) {
  if (!label) return <div>{children}</div>;
  if (block) {
    return (
      <div className="grid gap-[0.2em]">
        <p className="font-bold">{label}:</p>
        {children}
      </div>
    );
  }
  return (
    <div>
      <span className="font-bold">{label}: </span>
      {children}
    </div>
  );
}

function CustomValue({
  type,
  value,
  label,
  locale,
}: {
  type: string;
  value: unknown;
  label: string;
  locale: Locale;
}) {
  if (type === "LONG_TEXT") {
    const doc = richTextSchema.safeParse(value);
    return doc.success ? <RichTextView value={doc.data as RichText} /> : null;
  }
  if (type === "LIST" && Array.isArray(value)) {
    return (
      <ul className="list-disc pl-[1.2em]">
        {value.map((v, i) => (
          <li key={i}>{String(v)}</li>
        ))}
      </ul>
    );
  }
  if (type === "NUMBER" && typeof value === "number") return <>{formatNumber(value, locale)}</>;
  if (type === "IMAGE" && typeof value === "string") {
    return (
      <AssetImage assetId={value} alt={label} className="max-h-[16em] w-full object-contain" />
    );
  }
  return <>{String(value)}</>;
}
