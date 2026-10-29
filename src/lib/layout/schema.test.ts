import { describe, expect, it } from "vitest";
import {
  COMPACT_LAYOUT,
  DEFAULT_LAYOUT,
  layoutConfigSchema,
  parseLayoutConfig,
  type LayoutConfig,
} from "./schema";

function clone(config: LayoutConfig): LayoutConfig {
  return structuredClone(config);
}

describe("layoutConfigSchema", () => {
  it("accepts the shipped layouts", () => {
    expect(layoutConfigSchema.safeParse(DEFAULT_LAYOUT).success).toBe(true);
    expect(layoutConfigSchema.safeParse(COMPACT_LAYOUT).success).toBe(true);
  });

  it("accepts custom field references by UUID", () => {
    const config = clone(DEFAULT_LAYOUT);
    config.columns[0]!.fields.push({
      field: "custom:0192f0c1-7a3b-7c4d-8e5f-0123456789ab",
      showLabel: true,
    });
    expect(layoutConfigSchema.safeParse(config).success).toBe(true);
  });

  it("rejects a field placed in two columns", () => {
    const config = clone(DEFAULT_LAYOUT);
    config.columns[3]!.fields.push({ field: "title", showLabel: false });
    expect(layoutConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects duplicate column ids", () => {
    const config = clone(DEFAULT_LAYOUT);
    config.columns[1]!.id = "duration";
    expect(layoutConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects a column without any heading", () => {
    const config = clone(DEFAULT_LAYOUT);
    config.columns[0]!.labelKey = null;
    expect(layoutConfigSchema.safeParse(config).success).toBe(false);
  });

  it.each([
    ["unknown field", { field: "password", showLabel: false }],
    ["malformed custom ref", { field: "custom:../../etc", showLabel: false }],
  ])("rejects %s", (_label, field) => {
    const config = clone(DEFAULT_LAYOUT) as unknown as { columns: { fields: unknown[] }[] };
    config.columns[0]!.fields.push(field);
    expect(layoutConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects no columns, too many columns and bad widths", () => {
    expect(layoutConfigSchema.safeParse({ version: 1, columns: [] }).success).toBe(false);
    const many = clone(DEFAULT_LAYOUT);
    many.columns = Array.from({ length: 7 }, (_, i) => ({
      id: `c${i}`,
      label: "x",
      labelKey: null,
      width: 1,
      fields: [],
    }));
    expect(layoutConfigSchema.safeParse(many).success).toBe(false);
    const wide = clone(DEFAULT_LAYOUT);
    wide.columns[0]!.width = 0;
    expect(layoutConfigSchema.safeParse(wide).success).toBe(false);
  });
});

describe("document settings", () => {
  it("fills in defaults for layouts stored before document settings existed", () => {
    const { document: _document, ...stored } = clone(DEFAULT_LAYOUT);
    const parsed = layoutConfigSchema.parse(stored);
    expect(parsed.document).toEqual(DEFAULT_LAYOUT.document);
  });

  it("rejects duplicate or unknown conditions and boxes", () => {
    const dup = clone(DEFAULT_LAYOUT);
    dup.document.conditions = ["age", "age"];
    expect(layoutConfigSchema.safeParse(dup).success).toBe(false);
    const unknown = clone(DEFAULT_LAYOUT) as unknown as { document: { boxes: string[] } };
    unknown.document.boxes = ["password"];
    expect(layoutConfigSchema.safeParse(unknown).success).toBe(false);
  });

  it("rejects unknown document keys and text sizes", () => {
    const extra = clone(DEFAULT_LAYOUT) as unknown as { document: Record<string, unknown> };
    extra.document.html = "<script>";
    expect(layoutConfigSchema.safeParse(extra).success).toBe(false);
    const size = clone(DEFAULT_LAYOUT) as unknown as { document: Record<string, unknown> };
    size.document.textSize = "huge";
    expect(layoutConfigSchema.safeParse(size).success).toBe(false);
  });

  it("falls back to the default layout for unreadable stored configs", () => {
    expect(parseLayoutConfig({ version: 2 })).toBe(DEFAULT_LAYOUT);
    expect(parseLayoutConfig(COMPACT_LAYOUT)).toEqual(COMPACT_LAYOUT);
  });
});
