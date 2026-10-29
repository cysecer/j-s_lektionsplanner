import {
  BUILTIN_FIELDS,
  LAYOUT_MAX_COLUMNS,
  type LayoutColumn,
  type LayoutConfig,
  type LayoutFieldRef,
} from "./schema";

/** Every field a layout can place: built-ins first, then the given custom fields. */
export function availableFields(customFieldIds: string[]): LayoutFieldRef[] {
  return [...BUILTIN_FIELDS, ...customFieldIds.map((id) => `custom:${id}` as const)];
}

/** Fields of `available` that are in no column, in canonical order. */
export function hiddenFields(config: LayoutConfig, available: LayoutFieldRef[]): LayoutFieldRef[] {
  const used = new Set(config.columns.flatMap((c) => c.fields.map((f) => f.field)));
  return available.filter((f) => !used.has(f));
}

/** Column that holds a field, or null when the field is hidden. */
export function columnOf(config: LayoutConfig, field: LayoutFieldRef): string | null {
  return config.columns.find((c) => c.fields.some((f) => f.field === field))?.id ?? null;
}

/** Drops references to fields that no longer exist (deleted or archived custom fields). */
export function withoutUnknownFields(
  config: LayoutConfig,
  available: LayoutFieldRef[],
): LayoutConfig {
  const known = new Set(available);
  return {
    ...config,
    columns: config.columns.map((c) => ({
      ...c,
      fields: c.fields.filter((f) => known.has(f.field)),
    })),
  };
}

/**
 * Moves a field into a column (before `beforeField`, or to the end), or
 * hides it when `toColumnId` is null. Keeps its "show label" setting.
 */
export function moveField(
  config: LayoutConfig,
  field: LayoutFieldRef,
  toColumnId: string | null,
  beforeField: LayoutFieldRef | null,
): LayoutConfig {
  const existing = config.columns.flatMap((c) => c.fields).find((f) => f.field === field);
  const entry = existing ?? { field, showLabel: false };
  const columns = config.columns.map((c) => ({
    ...c,
    fields: c.fields.filter((f) => f.field !== field),
  }));
  const target = columns.find((c) => c.id === toColumnId);
  if (target) {
    const index = beforeField ? target.fields.findIndex((f) => f.field === beforeField) : -1;
    target.fields.splice(index < 0 ? target.fields.length : index, 0, entry);
  }
  return { ...config, columns };
}

/** One step up (-1) or down (1) within its column. */
export function nudgeField(
  config: LayoutConfig,
  field: LayoutFieldRef,
  direction: -1 | 1,
): LayoutConfig {
  return {
    ...config,
    columns: config.columns.map((c) => {
      const from = c.fields.findIndex((f) => f.field === field);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= c.fields.length) return c;
      const fields = [...c.fields];
      const [moved] = fields.splice(from, 1);
      fields.splice(to, 0, moved!);
      return { ...c, fields };
    }),
  };
}

export function setShowLabel(
  config: LayoutConfig,
  field: LayoutFieldRef,
  showLabel: boolean,
): LayoutConfig {
  return {
    ...config,
    columns: config.columns.map((c) => ({
      ...c,
      fields: c.fields.map((f) => (f.field === field ? { ...f, showLabel } : f)),
    })),
  };
}

export function updateColumn(
  config: LayoutConfig,
  columnId: string,
  patch: Partial<Pick<LayoutColumn, "label" | "width">>,
): LayoutConfig {
  return {
    ...config,
    columns: config.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)),
  };
}

export function addColumn(config: LayoutConfig, id: string, label: string): LayoutConfig {
  if (config.columns.length >= LAYOUT_MAX_COLUMNS) return config;
  return {
    ...config,
    columns: [...config.columns, { id, label, labelKey: null, width: 2, fields: [] }],
  };
}

/** Removes a column; its fields become hidden. The last column stays. */
export function removeColumn(config: LayoutConfig, columnId: string): LayoutConfig {
  if (config.columns.length <= 1) return config;
  return { ...config, columns: config.columns.filter((c) => c.id !== columnId) };
}

/** One step left (-1) or right (1). */
export function moveColumn(config: LayoutConfig, columnId: string, direction: -1 | 1) {
  const from = config.columns.findIndex((c) => c.id === columnId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= config.columns.length) return config;
  const columns = [...config.columns];
  const [moved] = columns.splice(from, 1);
  columns.splice(to, 0, moved!);
  return { ...config, columns };
}

/** Moves an entry of a list one step, used for the order of conditions. */
export function nudgeInList<T>(list: T[], value: T, direction: -1 | 1): T[] {
  const from = list.indexOf(value);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(to, 0, value);
  return next;
}
