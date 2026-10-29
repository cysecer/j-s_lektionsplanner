/**
 * Demo data based on the sample Lektionsvorbereitung "Spiele" (28.11.2018).
 * Coach names are invented. Runs only on an empty database.
 *
 *   npm run db:seed        (or automatically after `npm run db:reset`)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Difficulty } from "../src/generated/prisma/client";
import { COMPACT_LAYOUT, DEFAULT_LAYOUT, layoutConfigSchema } from "../src/lib/layout/schema";
import { buildSearchText } from "../src/lib/blocks/search-text";
import { richTextSchema, type RichText } from "../src/lib/rich-text/schema";
import { richTextFromBullets, richTextFromParagraphs } from "../src/lib/rich-text/utils";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

/** Seed data goes through the same validation as user input. */
function rt(doc: RichText): RichText {
  return richTextSchema.parse(doc);
}

const p = (...texts: string[]) => rt(richTextFromParagraphs(...texts));

type BlockSeed = {
  title: string;
  durationMinutes: number;
  description?: RichText;
  rules?: RichText;
  variations?: string[];
  organization?: RichText;
  material?: string[];
  tags: string[];
  section: "INTRO" | "MAIN" | "END";
  ageMin?: number;
  ageMax?: number;
  difficulty?: Difficulty;
};

const blocks: BlockSeed[] = [
  {
    title: "Dschungelspiel (eine Art Keulenstehlen)",
    durationMinutes: 20,
    description: p(
      "Bälle in der ganzen Halle verteilen.",
      "Die Sammler sammeln die Edelsteine (Bälle) ein und legen sie in die Schatztruhe (Kastenoberteile).",
      "Die Affen klauen die Edelsteine aus der Schatztruhe und verteilen sie wieder in der Halle.",
      "Schaffen es die Sammler, alle Edelsteine einzusammeln?",
    ),
    rules: p("Edelsteine dürfen nicht geworfen werden!"),
    variations: [
      "Mehr Sammler einsetzen als Affen, bis die Sammler gewinnen",
      "Jeder Affe, der einen Edelstein gestohlen hat, springt durch den Reifen-Parcours",
    ],
    organization: p(
      "2 Gruppen (Affen und Sammler)",
      "Kastenoberteile in der Mitte der 4 Seitenwände platzieren",
    ),
    material: ["Viele Bälle", "4 Kasten-Teile", "Reifen-Parcours aufstellen"],
    tags: ["Fangspiel", "Laufspiel"],
    section: "INTRO",
    ageMin: 6,
    ageMax: 12,
    difficulty: "EASY",
  },
  {
    title: "Keulenfussball",
    durationMinutes: 20,
    description: p(
      "Jedes Kind erhält eine Keule. Es beschützt seine Keule und versucht, die Keulen der anderen abzuschiessen.",
    ),
    variations: ["2er Teams verteidigen eine Keule"],
    organization: p("Jeder gegen jeden"),
    material: ["Keulen", "4 Fussbälle"],
    tags: ["Ballspiel", "Fussball"],
    section: "MAIN",
    ageMin: 7,
    ageMax: 14,
    difficulty: "MEDIUM",
  },
  {
    title: "Mattenfussball",
    durationMinutes: 20,
    description: p(
      "Immer zwei Kinder verteidigen eine Matte und versuchen, bei den anderen ein Tor zu erzielen (der Ball trifft die Matte).",
      "Getroffene Matten werden abgelegt. Sie dürfen wieder aufgestellt werden, sobald das Team, das sie getroffen hat, seine eigene Matte ablegen muss.",
    ),
    organization: p("Matten entlang der Wände aufstellen"),
    material: ["Ca. 10 Matten", "4 Fussbälle"],
    tags: ["Ballspiel", "Fussball"],
    section: "MAIN",
    ageMin: 7,
    ageMax: 14,
    difficulty: "MEDIUM",
  },
  {
    title: "Appell",
    durationMinutes: 10,
    description: p(
      "Kurzer Abschluss im Kreis: Rückblick auf die Lektion und Informationen für die nächste Woche.",
    ),
    material: ["Jugimappe"],
    tags: ["Ritual"],
    section: "END",
  },
  {
    title: "Heigositzball",
    durationMinutes: 15,
    tags: ["Ballspiel", "Abschluss"],
    section: "END",
  },
];

async function main() {
  if ((await db.club.count()) > 0) {
    console.log(
      "Database already contains data – skipping seed. Use `npm run db:reset` to start over.",
    );
    return;
  }

  await db.$transaction(async (tx) => {
    const club = await tx.club.create({
      data: { name: "TV Musterdorf", pdfFooterText: "J+S-Kindersport" },
    });
    const clubId = club.id;

    const [standard] = await Promise.all([
      tx.layout.create({
        data: { clubId, name: "Standard", config: layoutConfigSchema.parse(DEFAULT_LAYOUT) },
      }),
      tx.layout.create({
        data: { clubId, name: "Kompakt", config: layoutConfigSchema.parse(COMPACT_LAYOUT) },
      }),
    ]);
    await tx.club.update({ where: { id: clubId }, data: { defaultLayoutId: standard.id } });

    const sectionIds: Record<BlockSeed["section"], string> = {
      INTRO: (await tx.section.create({ data: { clubId, builtin: "INTRO", sortOrder: 0 } })).id,
      MAIN: (await tx.section.create({ data: { clubId, builtin: "MAIN", sortOrder: 1 } })).id,
      END: (await tx.section.create({ data: { clubId, builtin: "END", sortOrder: 2 } })).id,
    };

    const teamNames = ["Kids", "TuVo", "Jugi"];
    const teams = Object.fromEntries(
      await Promise.all(
        teamNames.map(async (name, sortOrder) => [
          name,
          (await tx.team.create({ data: { clubId, name, sortOrder } })).id,
        ]),
      ),
    ) as Record<string, string>;

    const coachSeeds: [string, string[]][] = [
      ["Andrea Keller", ["Kids"]],
      ["Marco Steiner", ["Kids"]],
      ["Nina Brunner", ["TuVo"]],
      ["Luca Meier", ["TuVo", "Jugi"]],
      ["Sandro Frei", ["Jugi"]],
    ];
    const coaches: Record<string, string> = {};
    for (const [name, teamList] of coachSeeds) {
      const coach = await tx.coach.create({
        data: {
          clubId,
          name,
          teams: { create: teamList.map((t) => ({ teamId: teams[t]! })) },
        },
      });
      coaches[name] = coach.id;
    }

    const tagNames = [...new Set([...blocks.flatMap((b) => b.tags), "Kraft", "Koordination"])];
    const tags: Record<string, string> = {};
    for (const name of tagNames) {
      tags[name] = (await tx.tag.create({ data: { clubId, name } })).id;
    }

    const blockIds: Record<string, string> = {};
    for (const b of blocks) {
      const block = await tx.programBlock.create({
        data: {
          clubId,
          title: b.title,
          durationMinutes: b.durationMinutes,
          description: b.description,
          rules: b.rules,
          variations: b.variations ?? [],
          organization: b.organization,
          material: b.material ?? [],
          suggestedSectionId: sectionIds[b.section],
          ageMin: b.ageMin,
          ageMax: b.ageMax,
          difficulty: b.difficulty,
          searchText: buildSearchText({
            title: b.title,
            description: b.description ?? null,
            rules: b.rules ?? null,
            variations: b.variations ?? [],
            organization: b.organization ?? null,
            material: b.material ?? [],
            responsibleText: null,
            customTexts: [],
          }),
          tags: { create: b.tags.map((t) => ({ tagId: tags[t]! })) },
          teams: { create: [{ teamId: teams.Kids! }, { teamId: teams.TuVo! }] },
        },
      });
      blockIds[b.title] = block.id;
    }

    // The sample lesson, using the club defaults (18:00, 90 minutes).
    const lesson = await tx.lesson.create({
      data: {
        clubId,
        teamId: teams.Kids,
        layoutId: standard.id,
        title: "Spiele",
        authorName: "Andrea Keller",
        date: new Date("2018-11-28T00:00:00Z"),
        startTimeMinutes: club.defaultStartTimeMinutes,
        totalDurationMinutes: club.defaultDurationMinutes,
        location: "Halle 2 (Halle 1 für TuVo)",
        ageMin: 7,
        ageMax: 11,
        groupSize: "ca. 20 Kids / 12 TuVo",
        difficulty: "MEDIUM",
        goals: rt(richTextFromBullets(["Spiele (Fussball und andere Spiele)"])),
        notes: p("Halle 2: Andrea und Marco / Halle 1: Nina, Luca und Sandro"),
        status: "FINAL",
        presentCoaches: { create: Object.values(coaches).map((coachId) => ({ coachId })) },
      },
    });

    const fromBlock = (title: string) => {
      const b = blocks.find((x) => x.title === title)!;
      return {
        sourceBlockId: blockIds[title]!,
        title: b.title,
        durationMinutes: b.durationMinutes,
        description: b.description,
        rules: b.rules,
        variations: b.variations ?? [],
        organization: b.organization,
        material: b.material ?? [],
      };
    };

    const items = [
      // One-off item without a library block
      { sectionId: sectionIds.INTRO, title: "Information Unihockey-Turnier", durationMinutes: 5 },
      { sectionId: sectionIds.INTRO, ...fromBlock("Dschungelspiel (eine Art Keulenstehlen)") },
      { sectionId: sectionIds.MAIN, ...fromBlock("Keulenfussball") },
      { sectionId: sectionIds.MAIN, ...fromBlock("Mattenfussball") },
      { sectionId: sectionIds.END, ...fromBlock("Appell") },
      { sectionId: sectionIds.END, ...fromBlock("Heigositzball") },
    ];
    const order: Record<string, number> = {};
    for (const item of items) {
      const sortOrder = order[item.sectionId] ?? 0;
      order[item.sectionId] = sortOrder + 1;
      await tx.lessonItem.create({ data: { lessonId: lesson.id, sortOrder, ...item } });
    }
  });

  console.log("Seed complete: club, 3 teams, 5 coaches, 5 program blocks, 1 lesson.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
