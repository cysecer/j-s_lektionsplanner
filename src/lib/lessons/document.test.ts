import { describe, expect, it } from "vitest";
import { buildLessonDocument } from "./document";

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const item = (id: string, sectionId: string, durationMinutes: number | null) => ({
  id,
  sectionId,
  title: id,
  durationMinutes,
  description: paragraph(`about ${id}`),
  rules: null,
  variations: [],
  organization: { type: "doc", content: [] },
  sketches: [{ assetId: "a1" }],
  material: ["Ball"],
  responsibleCoach: null,
  responsibleText: "Gast",
  teamCount: 2,
  minParticipants: null,
  maxParticipants: 20,
  customValues: { f: "x" },
});

const lesson = {
  title: "Spiele",
  authorName: "Andrea",
  date: new Date("2018-11-28T00:00:00Z"),
  team: { name: "Kids" },
  startTimeMinutes: 18 * 60,
  totalDurationMinutes: 90,
  location: "Halle 2",
  ageMin: 7,
  ageMax: 11,
  groupSize: "ca. 20",
  difficulty: "MEDIUM" as const,
  safety: "not rich text",
  goals: paragraph("Spass"),
  notes: null,
  presentCoaches: [{ coachId: "c2" }, { coachId: "gone" }, { coachId: "c1" }],
  items: [
    item("b", "main", 20),
    item("a", "intro", 5),
    item("c", "main", null),
    item("d", "end", 10),
  ],
};

describe("buildLessonDocument", () => {
  const doc = buildLessonDocument(
    lesson,
    [
      { id: "intro", title: "Einleitung" },
      { id: "main", title: "Hauptteil" },
      { id: "end", title: "Ausklang" },
    ],
    new Map([
      ["c1", "Marco"],
      ["c2", "Andrea"],
    ]),
  );

  it("groups items by section in section order and computes clock times", () => {
    expect(doc.sections.map((s) => [s.title, s.items.map((i) => i.id)])).toEqual([
      ["Einleitung", ["a"]],
      ["Hauptteil", ["b", "c"]],
      ["Ausklang", ["d"]],
    ]);
    expect(doc.sections.flatMap((s) => s.items.map((i) => i.startTimeMinutes))).toEqual([
      18 * 60,
      18 * 60 + 5,
      18 * 60 + 25,
      18 * 60 + 25,
    ]);
  });

  it("keeps only valid, non-empty rich text", () => {
    expect(doc.safety).toBeNull();
    expect(doc.goals?.content).toHaveLength(1);
    const first = doc.sections[0]!.items[0]!;
    expect(first.description?.content).toHaveLength(1);
    expect(first.organization).toBeNull();
  });

  it("resolves names and plain values", () => {
    expect(doc.date).toBe("2018-11-28");
    expect(doc.presentCoaches).toEqual(["Andrea", "Marco"]);
    const first = doc.sections[0]!.items[0]!;
    expect(first).toMatchObject({
      responsible: "Gast",
      sketchAssetIds: ["a1"],
      customValues: { f: "x" },
      teamCount: 2,
      maxParticipants: 20,
    });
  });

  it("has no clock times without a start time", () => {
    const untimed = buildLessonDocument(
      { ...lesson, startTimeMinutes: null },
      [{ id: "main", title: "Hauptteil" }],
      new Map(),
    );
    expect(untimed.sections[0]!.items.map((i) => i.startTimeMinutes)).toEqual([null, null]);
  });
});
