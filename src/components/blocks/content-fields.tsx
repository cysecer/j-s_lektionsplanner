"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { AssetImage } from "@/components/asset-image";
import { FormField } from "@/components/form-field";
import { ImageUpload } from "@/components/image-upload";
import { ListEditor } from "@/components/list-editor";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { SketchesEditor } from "@/components/sketches-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldType } from "@/generated/prisma/enums";
import { BLOCK_LIMITS, type BlockContentValues } from "@/lib/blocks/schema";
import type { RichText } from "@/lib/rich-text/schema";

/**
 * Inputs for the content of a game/exercise, shared by the library editor
 * and the lesson item dialog so both edit exactly the same things.
 */

export type ContentSetter = <K extends keyof BlockContentValues>(
  key: K,
  value: BlockContentValues[K],
) => void;
export type ErrorLookup = (path: string) => string | undefined;
export type CustomFieldDef = { id: string; label: string; type: CustomFieldType };

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <span id={id} className="text-sm font-medium">
        {label}
      </span>
      {hint ? <p className="text-muted-foreground -mt-1 text-sm">{hint}</p> : null}
      {children}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ChoiceSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label id={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="lg" aria-labelledby={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CheckboxGroup({
  id,
  label,
  hint,
  items,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  items: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="grid gap-2" aria-labelledby={id}>
      <legend id={id} className="text-sm font-medium">
        {label}
      </legend>
      {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
      <div className="grid gap-1 sm:grid-cols-3">
        {items.map((item) => (
          <Label
            key={item.id}
            className="hover:bg-accent flex min-h-11 items-center gap-3 rounded-md px-2 font-normal"
          >
            <Checkbox
              checked={selected.includes(item.id)}
              onCheckedChange={(v) =>
                onChange(
                  v === true ? [...selected, item.id] : selected.filter((x) => x !== item.id),
                )
              }
            />
            {item.name}
          </Label>
        ))}
      </div>
    </fieldset>
  );
}

/** Number of teams and the group size range. */
export function GroupSizeFields({
  values,
  set,
  error,
}: {
  values: Pick<BlockContentValues, "teamCount" | "minParticipants" | "maxParticipants">;
  set: ContentSetter;
  error: ErrorLookup;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <FormField
        label={t("blocks.form.teamCount")}
        type="number"
        inputMode="numeric"
        min={1}
        max={BLOCK_LIMITS.teamCountMax}
        value={String(values.teamCount ?? "")}
        onChange={(e) => set("teamCount", e.target.value)}
        error={error("teamCount")}
      />
      <FormField
        label={t("blocks.form.minParticipants")}
        type="number"
        inputMode="numeric"
        min={1}
        max={BLOCK_LIMITS.participantsMax}
        value={String(values.minParticipants ?? "")}
        onChange={(e) => set("minParticipants", e.target.value)}
        error={error("minParticipants")}
      />
      <FormField
        label={t("blocks.form.maxParticipants")}
        type="number"
        inputMode="numeric"
        min={1}
        max={BLOCK_LIMITS.participantsMax}
        value={String(values.maxParticipants ?? "")}
        onChange={(e) => set("maxParticipants", e.target.value)}
        error={error("maxParticipants")}
      />
    </div>
  );
}

/** Description, rules, variations, organisation, sketches and material. */
export function ContentFields({
  values,
  set,
  error,
}: {
  values: BlockContentValues;
  set: ContentSetter;
  error: ErrorLookup;
}) {
  const t = useTranslations();
  const ids = {
    description: useId(),
    rules: useId(),
    variations: useId(),
    organization: useId(),
    sketches: useId(),
    material: useId(),
  };
  // Errors of single list entries ("variations.2") shown next to that entry.
  const listErrors = (field: "variations" | "material") =>
    Object.fromEntries(
      values[field]
        .map((_, index) => [index, error(`${field}.${index}`)] as const)
        .filter(([, message]) => message),
    ) as Record<number, string>;

  return (
    <div className="grid gap-6">
      <Field id={ids.description} label={t("blockFields.description")} error={error("description")}>
        <RichTextEditor
          labelledBy={ids.description}
          value={values.description as RichText | null}
          onChange={(v) => set("description", v)}
        />
      </Field>
      <Field id={ids.rules} label={t("blockFields.rules")} error={error("rules")}>
        <RichTextEditor
          labelledBy={ids.rules}
          value={values.rules as RichText | null}
          onChange={(v) => set("rules", v)}
        />
      </Field>
      <Field id={ids.variations} label={t("blockFields.variations")}>
        <ListEditor
          labelledBy={ids.variations}
          items={values.variations}
          onChange={(v) => set("variations", v)}
          max={BLOCK_LIMITS.variations}
          maxLength={BLOCK_LIMITS.listItem}
          errors={listErrors("variations")}
        />
      </Field>
      <Field
        id={ids.organization}
        label={t("blockFields.organization")}
        error={error("organization")}
      >
        <RichTextEditor
          labelledBy={ids.organization}
          value={values.organization as RichText | null}
          onChange={(v) => set("organization", v)}
        />
      </Field>
      <Field
        id={ids.sketches}
        label={t("blockFields.sketches")}
        hint={t("blocks.form.sketchesHint")}
      >
        <SketchesEditor
          assetIds={values.sketchAssetIds}
          onChange={(v) => set("sketchAssetIds", v)}
          max={BLOCK_LIMITS.sketches}
          title={values.title}
        />
      </Field>
      <Field id={ids.material} label={t("blockFields.material")}>
        <ListEditor
          labelledBy={ids.material}
          items={values.material}
          onChange={(v) => set("material", v)}
          max={BLOCK_LIMITS.material}
          maxLength={BLOCK_LIMITS.listItem}
          errors={listErrors("material")}
        />
      </Field>
    </div>
  );
}

/** Inputs for the club's custom fields, each according to its type. */
export function CustomFieldInputs({
  fields,
  values,
  onChange,
  error,
}: {
  fields: CustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  error: ErrorLookup;
}) {
  return (
    <div className="grid gap-6">
      {fields.map((field) => (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(v) => onChange(field.id, v)}
          error={error(`customValues.${field.id}`)}
        />
      ))}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: CustomFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const t = useTranslations();
  const id = useId();
  switch (field.type) {
    case "SHORT_TEXT":
      return (
        <FormField
          label={field.label}
          value={typeof value === "string" ? value : ""}
          maxLength={200}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
    case "NUMBER":
      return (
        <FormField
          label={field.label}
          type="number"
          inputMode="decimal"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
    case "LONG_TEXT":
      return (
        <Field id={id} label={field.label} error={error}>
          <RichTextEditor
            labelledBy={id}
            value={(value as RichText | null) ?? null}
            onChange={onChange}
          />
        </Field>
      );
    case "LIST":
      return (
        <Field id={id} label={field.label} error={error}>
          <ListEditor
            labelledBy={id}
            items={Array.isArray(value) ? (value as string[]) : []}
            onChange={onChange}
            max={50}
            maxLength={BLOCK_LIMITS.listItem}
          />
        </Field>
      );
    case "IMAGE":
      return (
        <Field id={id} label={field.label} error={error}>
          {typeof value === "string" && value ? (
            <div className="flex items-start gap-2">
              <AssetImage
                assetId={value}
                alt={field.label}
                className="bg-muted/40 max-h-48 rounded border object-contain"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`${field.label}: ${t("common.remove")}`}
                onClick={() => onChange(null)}
              >
                <X aria-hidden />
              </Button>
            </div>
          ) : (
            <ImageUpload purpose="field" onUploaded={(image) => onChange(image.id)} />
          )}
        </Field>
      );
  }
}

/** Drops empty values ("", [], null) so they are not sent as data. */
export function withoutEmptyValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, v]) =>
        !(
          v === undefined ||
          v === null ||
          (typeof v === "string" && v.trim() === "") ||
          (Array.isArray(v) && v.length === 0)
        ),
    ),
  );
}

export function withoutPrefix<T>(errors: Record<string, T> | undefined, prefix: string) {
  if (!errors) return errors;
  return Object.fromEntries(
    Object.entries(errors).map(([path, list]) => [
      path.startsWith(prefix) ? path.slice(prefix.length) : path,
      list,
    ]),
  );
}
