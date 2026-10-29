import "server-only";
import type { BuiltinSection } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { DEFAULT_LAYOUT, parseLayoutConfig, type LayoutConfig } from "@/lib/layout/schema";
import { buildLessonDocument, type DocumentClub, type LessonDocument } from "./document";
import { getLesson } from "./queries";

type SectionTitle = (section: { builtin: BuiltinSection | null; name: string | null }) => string;

/** Club name, logo, footer and all custom fields (labels for the document). */
export async function getDocumentClub(clubId: string): Promise<DocumentClub> {
  const club = await db.club.findUniqueOrThrow({
    where: { id: clubId },
    select: {
      name: true,
      logoAssetId: true,
      pdfFooterText: true,
      customFields: {
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: { id: true, label: true, type: true },
      },
    },
  });
  return {
    name: club.name,
    logoAssetId: club.logoAssetId,
    footerText: club.pdfFooterText,
    fields: club.customFields,
  };
}

/** The lesson's layout, else the club default, else the built-in default. */
export async function resolveLayout(
  clubId: string,
  layoutId: string | null,
): Promise<{ id: string | null; name: string | null; config: LayoutConfig }> {
  const layout =
    (layoutId &&
      (await db.layout.findFirst({
        where: { id: layoutId, clubId },
        select: { id: true, name: true, config: true },
      }))) ||
    (await db.club
      .findUniqueOrThrow({ where: { id: clubId } })
      .defaultLayout({ select: { id: true, name: true, config: true } }));
  return layout
    ? { id: layout.id, name: layout.name, config: parseLayoutConfig(layout.config) }
    : { id: null, name: null, config: DEFAULT_LAYOUT };
}

export async function getLessonDocument(
  clubId: string,
  lessonId: string,
  sectionTitle: SectionTitle,
): Promise<{ document: LessonDocument; layoutId: string | null } | null> {
  const lesson = await getLesson(clubId, lessonId);
  if (!lesson) return null;
  return {
    document: await toDocument(clubId, lesson, sectionTitle),
    layoutId: lesson.layoutId,
  };
}

/** Most recently edited lesson with content, for the layout editor's preview. */
export async function getPreviewDocument(clubId: string, sectionTitle: SectionTitle) {
  const latest = await db.lesson.findFirst({
    where: { clubId, items: { some: {} } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  const lesson = latest ? await getLesson(clubId, latest.id) : null;
  if (lesson) return toDocument(clubId, lesson, sectionTitle);
  return null;
}

/** Empty sections only: shows the column headings when no lesson exists yet. */
export async function getEmptyDocumentSections(clubId: string, sectionTitle: SectionTitle) {
  const sections = await db.section.findMany({
    where: { clubId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, builtin: true, name: true },
  });
  return sections.map((s) => ({ id: s.id, title: sectionTitle(s), items: [] }));
}

async function toDocument(
  clubId: string,
  lesson: NonNullable<Awaited<ReturnType<typeof getLesson>>>,
  sectionTitle: SectionTitle,
) {
  const [sections, coaches] = await Promise.all([
    db.section.findMany({
      where: { clubId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, builtin: true, name: true },
    }),
    db.coach.findMany({
      where: { clubId, id: { in: lesson.presentCoaches.map((c) => c.coachId) } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return buildLessonDocument(
    lesson,
    sections.map((s) => ({ id: s.id, title: sectionTitle(s) })),
    new Map(coaches.map((c) => [c.id, c.name])),
  );
}
