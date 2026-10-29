import { describe, expect, it } from "vitest";
import {
  addColumn,
  availableFields,
  columnOf,
  hiddenFields,
  moveColumn,
  moveField,
  nudgeField,
  nudgeInList,
  removeColumn,
  setShowLabel,
  updateColumn,
  withoutUnknownFields,
} from "./editor-model";
import { DEFAULT_LAYOUT, LAYOUT_MAX_COLUMNS, layoutConfigSchema } from "./schema";

const CUSTOM = "0192f0c1-7a3b-7c4d-8e5f-0123456789ab";
const fieldsOf = (config: typeof DEFAULT_LAYOUT, columnId: string) =>
  config.columns.find((c) => c.id === columnId)!.fields.map((f) => f.field);

describe("layout editor model", () => {
  it("lists built-ins and custom fields; hidden = not placed", () => {
    const available = availableFields([CUSTOM]);
    expect(available.at(-1)).toBe(`custom:${CUSTOM}`);
    expect(hiddenFields(DEFAULT_LAYOUT, available)).toEqual([
      "teamCount",
      "participants",
      `custom:${CUSTOM}`,
    ]);
  });

  it("moves a field between columns, before another one", () => {
    const next = moveField(DEFAULT_LAYOUT, "material", "topic", "description");
    expect(fieldsOf(next, "topic")).toEqual([
      "title",
      "material",
      "description",
      "rules",
      "variations",
    ]);
    expect(fieldsOf(next, "material")).toEqual([]);
    expect(layoutConfigSchema.safeParse(next).success).toBe(true);
  });

  it("keeps the label setting when moving and hides with null", () => {
    const moved = moveField(DEFAULT_LAYOUT, "variations", "material", null);
    expect(moved.columns.at(-1)!.fields.at(-1)).toEqual({ field: "variations", showLabel: true });
    const hidden = moveField(moved, "variations", null, null);
    expect(columnOf(hidden, "variations")).toBeNull();
  });

  it("places a hidden field without a label by default", () => {
    const next = moveField(DEFAULT_LAYOUT, "teamCount", "organization", null);
    expect(next.columns[2]!.fields.at(-1)).toEqual({ field: "teamCount", showLabel: false });
  });

  it("nudges inside a column and stops at the ends", () => {
    expect(fieldsOf(nudgeField(DEFAULT_LAYOUT, "rules", -1), "topic").slice(0, 3)).toEqual([
      "title",
      "rules",
      "description",
    ]);
    expect(nudgeField(DEFAULT_LAYOUT, "title", -1)).toEqual(DEFAULT_LAYOUT);
  });

  it("toggles labels and updates columns", () => {
    const labelled = setShowLabel(DEFAULT_LAYOUT, "material", true);
    expect(labelled.columns[3]!.fields[0]).toEqual({ field: "material", showLabel: true });
    const renamed = updateColumn(DEFAULT_LAYOUT, "topic", { label: "Spiel", width: 6 });
    expect(renamed.columns[1]).toMatchObject({ label: "Spiel", width: 6 });
  });

  it("adds up to the maximum and removes all but one column", () => {
    let config = DEFAULT_LAYOUT;
    for (let i = 0; i < 10; i++) config = addColumn(config, `c${i}`, "Neu");
    expect(config.columns).toHaveLength(LAYOUT_MAX_COLUMNS);
    expect(layoutConfigSchema.safeParse(config).success).toBe(true);
    for (const c of [...config.columns]) config = removeColumn(config, c.id);
    expect(config.columns).toHaveLength(1);
  });

  it("moves columns left and right", () => {
    expect(moveColumn(DEFAULT_LAYOUT, "material", -1).columns.map((c) => c.id)).toEqual([
      "duration",
      "topic",
      "material",
      "organization",
    ]);
    expect(moveColumn(DEFAULT_LAYOUT, "duration", -1)).toBe(DEFAULT_LAYOUT);
  });

  it("drops fields that no longer exist", () => {
    const withCustom = moveField(DEFAULT_LAYOUT, `custom:${CUSTOM}`, "topic", null);
    const cleaned = withoutUnknownFields(withCustom, availableFields([]));
    expect(columnOf(cleaned, `custom:${CUSTOM}`)).toBeNull();
  });

  it("nudges list entries", () => {
    expect(nudgeInList(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(nudgeInList(["a", "b"], "a", -1)).toEqual(["a", "b"]);
  });
});
