"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { AssetImage } from "@/components/asset-image";
import { FormField } from "@/components/form-field";
import { ImageUpload } from "@/components/image-upload";
import { ListEditor } from "@/components/list-editor";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { SectionCard } from "@/components/settings/section-card";
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
import { Difficulty, type BuiltinSection, type CustomFieldType } from "@/generated/prisma/enums";
import { BLOCK_LIMITS, type BlockFormValues } from "@/lib/blocks/schema";
import { firstFieldError } from "@/lib/i18n-keys";
import type { RichText } from "@/lib/rich-text/schema";
import { useAction } from "@/lib/use-action";
import { createBlockAction, updateBlockAction } from "./actions";

export type BlockFormOptions = {
  tags: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  sections: { id: string; builtin: BuiltinSection | null; name: string | null }[];
  fields: { id: string; label: string; type: CustomFieldType }[];
};

const NONE = "none";

function isEmptyValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function BlockForm({
  blockId,
  initial,
  options,
}: {
  blockId?: string;
  initial: BlockFormValues;
  options: BlockFormOptions;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const create = useAction(createBlockAction);
  const update = useAction(updateBlockAction);
  const action = blockId ? update : create;
  const ids = {
    description: useId(),
    rules: useId(),
    variations: useId(),
    organization: useId(),
    sketches: useId(),
    material: useId(),
    tags: useId(),
    teams: useId(),
    section: useId(),
    difficulty: useId(),
    fields: useId(),
  };

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof BlockFormValues>(key: K, value: BlockFormValues[K]) {
    setDirty(true);
    setValues((v) => ({ ...v, [key]: value }));
  }
  function setCustom(id: string, value: unknown) {
    setDirty(true);
    setValues((v) => ({ ...v, customValues: { ...v.customValues, [id]: value } }));
  }
  const error = (path: string) => firstFieldError(t, action.fieldErrors, path);
  const listErrors = (field: string) =>
    Object.fromEntries(
      Object.keys(action.fieldErrors ?? {})
        .filter((k) => k.startsWith(`${field}.`))
        .map((k) => [Number(k.split(".")[1]), error(k)!]),
    );
  const sectionName = (s: BlockFormOptions["sections"][number]) =>
    s.name ?? (s.builtin ? t(`sections.${s.builtin}`) : "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const block: BlockFormValues = {
      ...values,
      variations: values.variations.map((x) => x.trim()).filter(Boolean),
      material: values.material.map((x) => x.trim()).filter(Boolean),
      customValues: Object.fromEntries(
        Object.entries(values.customValues).filter(([, v]) => !isEmptyValue(v)),
      ),
    };
    const result = blockId
      ? await update.run({ id: blockId, block }, { success: t("blocks.form.saved") })
      : await create.run(block, { success: t("blocks.form.saved") });
    if (result) {
      setDirty(false);
      router.push(`/blocks/${result.id}`);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <SectionCard title={t("blocks.form.basics")}>
        <div className="grid gap-5">
          <FormField
            label={t("blockFields.title")}
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={BLOCK_LIMITS.title}
            required
            error={error("title")}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label={`${t("blockFields.duration")} (${t("common.minutes")})`}
              type="number"
              inputMode="numeric"
              min={0}
              max={BLOCK_LIMITS.durationMax}
              step={5}
              value={String(values.durationMinutes ?? "")}
              onChange={(e) => set("durationMinutes", e.target.value)}
              error={error("durationMinutes")}
            />
            <ChoiceSelect
              id={ids.section}
              label={t("blocks.form.suggestedSection")}
              value={values.suggestedSectionId ?? NONE}
              onChange={(v) => set("suggestedSectionId", v === NONE ? null : v)}
              options={[
                { value: NONE, label: t("blocks.form.noSection") },
                ...options.sections.map((s) => ({ value: s.id, label: sectionName(s) })),
              ]}
            />
            <ChoiceSelect
              id={ids.difficulty}
              label={t("blocks.difficultyLabel")}
              value={values.difficulty ?? NONE}
              onChange={(v) => set("difficulty", v === NONE ? null : (v as Difficulty))}
              options={[
                { value: NONE, label: t("blocks.form.noDifficulty") },
                ...Object.values(Difficulty).map((d) => ({
                  value: d,
                  label: t(`difficulty.${d}`),
                })),
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label={t("blocks.form.ageMin")}
                type="number"
                inputMode="numeric"
                min={0}
                max={BLOCK_LIMITS.ageMax}
                value={String(values.ageMin ?? "")}
                onChange={(e) => set("ageMin", e.target.value)}
                error={error("ageMin")}
              />
              <FormField
                label={t("blocks.form.ageMax")}
                type="number"
                inputMode="numeric"
                min={0}
                max={BLOCK_LIMITS.ageMax}
                value={String(values.ageMax ?? "")}
                onChange={(e) => set("ageMax", e.target.value)}
                error={error("ageMax")}
              />
            </div>
          </div>
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
        </div>
      </SectionCard>

      <SectionCard title={t("blocks.form.content")}>
        <div className="grid gap-6">
          <Field
            id={ids.description}
            label={t("blockFields.description")}
            error={error("description")}
          >
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
      </SectionCard>

      <SectionCard title={t("blocks.form.assignment")}>
        <div className="grid gap-6">
          <CheckboxGroup
            id={ids.tags}
            label={t("blocks.tags")}
            items={options.tags}
            selected={values.tagIds}
            onChange={(v) => set("tagIds", v)}
          />
          <CheckboxGroup
            id={ids.teams}
            label={t("blocks.team")}
            hint={t("blocks.form.teamsHint")}
            items={options.teams}
            selected={values.teamIds}
            onChange={(v) => set("teamIds", v)}
          />
        </div>
      </SectionCard>

      {options.fields.length > 0 ? (
        <SectionCard title={t("blocks.form.customFields")}>
          <div className="grid gap-6">
            {options.fields.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={values.customValues[field.id]}
                onChange={(v) => setCustom(field.id, v)}
                error={error(`customValues.${field.id}`)}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="bg-background/95 sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t px-4 py-3 backdrop-blur">
        <Button asChild variant="outline" className="h-11">
          <Link href={blockId ? `/blocks/${blockId}` : "/blocks"}>{t("common.cancel")}</Link>
        </Button>
        <Button type="submit" className="h-11" disabled={action.pending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function Field({
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

function ChoiceSelect({
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

function CheckboxGroup({
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

function CustomFieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: BlockFormOptions["fields"][number];
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
