import { z } from "zod";

/**
 * Layout of a program-block row (PDF export and on-screen read view):
 * an ordered list of columns, each holding an ordered list of fields.
 * A field that appears in no column is hidden.
 */

export const BUILTIN_FIELDS = [
  "duration",
  "title",
  "description",
  "rules",
  "variations",
  "organization",
  "sketches",
  "material",
  "responsible",
  "teamCount",
  "participants",
] as const;

export type BuiltinField = (typeof BUILTIN_FIELDS)[number];

/** Column headings that ship with the app and are translated in the UI and PDF. */
export const BUILTIN_COLUMN_LABELS = ["duration", "topic", "organization", "material"] as const;

export const LAYOUT_MAX_COLUMNS = 6;
export const LAYOUT_MAX_WIDTH = 12;

const customFieldRef = z
  .string()
  .regex(/^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

export const layoutFieldRefSchema = z.union([z.enum(BUILTIN_FIELDS), customFieldRef]);
export type LayoutFieldRef = z.infer<typeof layoutFieldRefSchema>;

export const layoutFieldSchema = z.strictObject({
  field: layoutFieldRefSchema,
  showLabel: z.boolean(),
});

export const layoutColumnSchema = z
  .strictObject({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
    /** Custom heading; when null, `labelKey` provides a translated default. */
    label: z.string().trim().min(1).max(60).nullable(),
    labelKey: z.enum(BUILTIN_COLUMN_LABELS).nullable(),
    /** Relative width; columns share the row in proportion to these values. */
    width: z.int().min(1).max(LAYOUT_MAX_WIDTH),
    fields: z.array(layoutFieldSchema).max(BUILTIN_FIELDS.length + 50),
  })
  .refine((c) => c.label !== null || c.labelKey !== null, {
    message: "validation.layoutColumnLabelRequired",
    path: ["label"],
  });

export const layoutConfigSchema = z
  .strictObject({
    version: z.literal(1),
    columns: z.array(layoutColumnSchema).min(1).max(LAYOUT_MAX_COLUMNS),
  })
  .superRefine((config, ctx) => {
    const columnIds = new Set<string>();
    const fields = new Set<string>();
    config.columns.forEach((column, ci) => {
      if (columnIds.has(column.id)) {
        ctx.addIssue({
          code: "custom",
          message: "validation.layoutDuplicateColumn",
          path: ["columns", ci, "id"],
        });
      }
      columnIds.add(column.id);
      column.fields.forEach((f, fi) => {
        if (fields.has(f.field)) {
          ctx.addIssue({
            code: "custom",
            message: "validation.layoutDuplicateField",
            path: ["columns", ci, "fields", fi, "field"],
          });
        }
        fields.add(f.field);
      });
    });
  });

export type LayoutConfig = z.infer<typeof layoutConfigSchema>;
export type LayoutColumn = z.infer<typeof layoutColumnSchema>;

/** Reproduces the four columns of the paper Lektionsvorbereitung. */
export const DEFAULT_LAYOUT: LayoutConfig = {
  version: 1,
  columns: [
    {
      id: "duration",
      label: null,
      labelKey: "duration",
      width: 1,
      fields: [{ field: "duration", showLabel: false }],
    },
    {
      id: "topic",
      label: null,
      labelKey: "topic",
      width: 5,
      fields: [
        { field: "title", showLabel: false },
        { field: "description", showLabel: false },
        { field: "rules", showLabel: false },
        { field: "variations", showLabel: true },
      ],
    },
    {
      id: "organization",
      label: null,
      labelKey: "organization",
      width: 3,
      fields: [
        { field: "organization", showLabel: false },
        { field: "sketches", showLabel: false },
      ],
    },
    {
      id: "material",
      label: null,
      labelKey: "material",
      width: 2,
      fields: [
        { field: "material", showLabel: false },
        { field: "responsible", showLabel: true },
      ],
    },
  ],
};

/** A shorter alternative without sketches and organisation. */
export const COMPACT_LAYOUT: LayoutConfig = {
  version: 1,
  columns: [
    {
      id: "duration",
      label: null,
      labelKey: "duration",
      width: 1,
      fields: [{ field: "duration", showLabel: false }],
    },
    {
      id: "topic",
      label: null,
      labelKey: "topic",
      width: 6,
      fields: [
        { field: "title", showLabel: false },
        { field: "description", showLabel: false },
      ],
    },
    {
      id: "material",
      label: null,
      labelKey: "material",
      width: 3,
      fields: [
        { field: "material", showLabel: false },
        { field: "responsible", showLabel: false },
      ],
    },
  ],
};
