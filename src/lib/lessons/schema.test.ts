import { describe, expect, it } from "vitest";
import { lessonGeneralSchema, lessonSaveSchema, type LessonGeneralValues } from "./schema";

const uuid = (n: number) => `0192f0c1-7a3b-7c4d-8e5f-${String(n).padStart(12, "0")}`;

const general: LessonGeneralValues = {
  title: "Spiele",
  authorName: "Andrea Keller",
  date: "2018-11-28",
  teamId: uuid(1),
  layoutId: null,
  startTime: "18:00",
  totalDurationMinutes: "90",
  location: "Halle 2",
  ageMin: "7",
  ageMax: "11",
  groupSize: "ca. 20 Kids / 12 TuVo",
  difficulty: "MEDIUM",
  safety: null,
  goals: null,
  notes: null,
  presentCoachIds: [uuid(2), uuid(3)],
  status: "DRAFT",
};

const item = (n: number, patch: Record<string, unknown> = {}) => ({
  id: uuid(100 + n),
  sectionId: uuid(10),
  sourceBlockId: null,
  modifiedLocally: false,
  responsible: { kind: "none" },
  title: `Item ${n}`,
  durationMinutes: "10",
  description: null,
  rules: null,
  variations: [],
  organization: null,
  material: [],
  sketchAssetIds: [],
  teamCount: "",
  minParticipants: "",
  maxParticipants: "",
  customValues: {},
  ...patch,
});

describe("lessonGeneralSchema", () => {
  it("parses times, numbers and empty optional fields", () => {
    expect(lessonGeneralSchema.parse(general)).toMatchObject({
      startTime: 1080,
      totalDurationMinutes: 90,
      ageMin: 7,
    });
    expect(
      lessonGeneralSchema.parse({ ...general, startTime: "", location: "", groupSize: "" }),
    ).toMatchObject({ startTime: null, location: null, groupSize: null });
  });

  it.each<[string, Partial<LessonGeneralValues>]>([
    ["missing title", { title: "" }],
    ["invalid date", { date: "28.11.2018" }],
    ["impossible date", { date: "2018-02-30" }],
    ["invalid start time", { startTime: "25:00" }],
    ["zero duration", { totalDurationMinutes: "0" }],
    ["ages reversed", { ageMin: "12", ageMax: "8" }],
    ["duplicate coaches", { presentCoachIds: [uuid(2), uuid(2)] }],
    ["unknown status", { status: "ARCHIVED" as never }],
  ])("rejects %s", (_label, patch) => {
    expect(lessonGeneralSchema.safeParse({ ...general, ...patch }).success).toBe(false);
  });
});

describe("lessonSaveSchema", () => {
  const save = (items: unknown[]) => ({
    id: uuid(50),
    baseVersion: "2026-10-29T10:00:00.000Z",
    lesson: general,
    items,
  });

  it("accepts a lesson with items and responsible persons", () => {
    const parsed = lessonSaveSchema.parse(
      save([
        item(1, { responsible: { kind: "coach", coachId: uuid(2) } }),
        item(2, { responsible: { kind: "text", text: "Gast-Leiterin" }, sourceBlockId: uuid(60) }),
      ]),
    );
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]!.durationMinutes).toBe(10);
  });

  it.each([
    ["duplicate item ids", [item(1), item(1)]],
    ["too many items", Array.from({ length: 81 }, (_, i) => item(i))],
    ["item without title", [item(1, { title: "" })]],
    ["participants reversed", [item(1, { minParticipants: "20", maxParticipants: "5" })]],
    ["unknown key on item", [item(1, { clubId: uuid(9) })]],
  ])("rejects %s", (_label, items) => {
    expect(lessonSaveSchema.safeParse(save(items)).success).toBe(false);
  });

  it("requires an ISO base version", () => {
    expect(lessonSaveSchema.safeParse({ ...save([]), baseVersion: "gestern" }).success).toBe(false);
  });
});
