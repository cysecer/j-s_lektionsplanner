import { describe, expect, it } from "vitest";
import {
  blankItem,
  insertItem,
  itemsOf,
  moveItem,
  normalize,
  nudgeItem,
  parseMinutes,
  timingInput,
  type EditorItem,
} from "./editor-model";
import { computeLessonTiming } from "./timing";

const S = ["intro", "main", "end"];
const item = (id: string, sectionId: string, minutes = "10") =>
  blankItem(id, sectionId, id, minutes);
const ids = (items: EditorItem[], section?: string) =>
  (section ? itemsOf(items, section) : items).map((i) => i.id);

const base = [
  item("info", "intro", "5"),
  item("dschungel", "intro", "20"),
  item("keulen", "main", "20"),
  item("matten", "main", "20"),
  item("appell", "end", "10"),
];

describe("editor model", () => {
  it("groups by section order and keeps order within sections", () => {
    // Within "intro" the shuffled order (info before dschungel) is kept.
    const shuffled = [base[4]!, base[2]!, base[0]!, base[3]!, base[1]!];
    expect(ids(normalize(shuffled, S))).toEqual([
      "info",
      "dschungel",
      "keulen",
      "matten",
      "appell",
    ]);
  });

  it("moves within a section before another item", () => {
    const moved = moveItem(base, S, "matten", "main", "keulen");
    expect(ids(moved, "main")).toEqual(["matten", "keulen"]);
  });

  it("moves across sections, to a position or to the end", () => {
    const toPosition = moveItem(base, S, "appell", "main", "matten");
    expect(ids(toPosition, "main")).toEqual(["keulen", "appell", "matten"]);
    expect(ids(toPosition, "end")).toEqual([]);
    expect(toPosition.find((i) => i.id === "appell")!.sectionId).toBe("main");

    const toEnd = moveItem(base, S, "info", "end", null);
    expect(ids(toEnd, "end")).toEqual(["appell", "info"]);
  });

  it("ignores unknown items and moving onto itself", () => {
    expect(moveItem(base, S, "nope", "main", null)).toBe(base);
    expect(moveItem(base, S, "keulen", "main", "keulen")).toBe(base);
  });

  it("inserts new items into empty and filled sections", () => {
    const empty = insertItem([], S, item("new", "main"), null);
    expect(ids(empty)).toEqual(["new"]);
    const before = insertItem(base, S, item("new", "intro"), "dschungel");
    expect(ids(before, "intro")).toEqual(["info", "new", "dschungel"]);
    // "before" an item of another section falls back to the end of the target section
    const mismatch = insertItem(base, S, item("new", "end"), "keulen");
    expect(ids(mismatch, "end")).toEqual(["appell", "new"]);
  });

  it("nudges one step and stays put at the edges", () => {
    expect(ids(nudgeItem(base, S, "matten", -1), "main")).toEqual(["matten", "keulen"]);
    expect(nudgeItem(base, S, "keulen", -1)).toBe(base);
    expect(nudgeItem(base, S, "matten", 1)).toBe(base);
  });

  it("feeds the timing calculation", () => {
    const timing = computeLessonTiming(timingInput(base, S, 18 * 60, 90));
    expect(timing.totalMinutes).toBe(75);
    expect(timing.differenceMinutes).toBe(15);
    expect(timing.items.appell!.startTimeMinutes).toBe(18 * 60 + 65);
  });

  it("parses minutes leniently but safely", () => {
    expect(parseMinutes("20")).toBe(20);
    expect([
      parseMinutes(""),
      parseMinutes("abc"),
      parseMinutes("-5"),
      parseMinutes("2.5"),
    ]).toEqual([null, null, null, null]);
  });
});
