"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import {
  CheckboxGroup,
  ChoiceSelect,
  ContentFields,
  CustomFieldInputs,
  GroupSizeFields,
  withoutEmptyValues,
  withoutPrefix,
  type ContentSetter,
} from "@/components/blocks/content-fields";
import { FormField } from "@/components/form-field";
import { SectionCard } from "@/components/settings/section-card";
import { Button } from "@/components/ui/button";
import { Difficulty, type BuiltinSection, type CustomFieldType } from "@/generated/prisma/enums";
import { BLOCK_LIMITS, type BlockFormValues } from "@/lib/blocks/schema";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import { createBlockAction, updateBlockAction } from "./actions";

export type BlockFormOptions = {
  tags: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  sections: { id: string; builtin: BuiltinSection | null; name: string | null }[];
  fields: { id: string; label: string; type: CustomFieldType }[];
};

const NONE = "none";

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
  const ids = { tags: useId(), teams: useId(), section: useId(), difficulty: useId() };

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
  const setContent: ContentSetter = (key, value) => set(key, value as BlockFormValues[typeof key]);
  function setCustom(id: string, value: unknown) {
    setDirty(true);
    setValues((v) => ({ ...v, customValues: { ...v.customValues, [id]: value } }));
  }

  // The update action wraps the values as { id, block }; strip that prefix so
  // errors land on the same fields as when creating.
  const fieldErrors = blockId ? withoutPrefix(update.fieldErrors, "block.") : create.fieldErrors;
  const error = (path: string) => firstFieldError(t, fieldErrors, path);
  const labels: Record<string, string> = {
    title: t("blockFields.title"),
    durationMinutes: t("blockFields.duration"),
    description: t("blockFields.description"),
    rules: t("blockFields.rules"),
    variations: t("blockFields.variations"),
    organization: t("blockFields.organization"),
    material: t("blockFields.material"),
    sketchAssetIds: t("blockFields.sketches"),
    tagIds: t("blocks.tags"),
    teamIds: t("blocks.team"),
    suggestedSectionId: t("blocks.form.suggestedSection"),
    difficulty: t("blocks.difficultyLabel"),
    ageMin: t("blocks.form.ageMin"),
    ageMax: t("blocks.form.ageMax"),
    teamCount: t("blocks.form.teamCount"),
    minParticipants: t("blocks.form.minParticipants"),
    maxParticipants: t("blocks.form.maxParticipants"),
    ...Object.fromEntries(options.fields.map((f) => [`customValues.${f.id}`, f.label])),
  };
  const prefixedLabels = Object.fromEntries(
    Object.entries(labels).flatMap(([k, v]) => [
      [k, v],
      [`block.${k}`, v],
    ]),
  );
  const sectionName = (s: BlockFormOptions["sections"][number]) =>
    s.name ?? (s.builtin ? t(`sections.${s.builtin}`) : "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const block: BlockFormValues = {
      ...values,
      variations: values.variations.map((x) => x.trim()).filter(Boolean),
      material: values.material.map((x) => x.trim()).filter(Boolean),
      customValues: withoutEmptyValues(values.customValues),
    };
    const runOptions = { success: t("blocks.form.saved"), labels: prefixedLabels };
    const result = blockId
      ? await update.run({ id: blockId, block }, runOptions)
      : await create.run(block, runOptions);
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
          <GroupSizeFields values={values} set={setContent} error={error} />
        </div>
      </SectionCard>

      <SectionCard title={t("blocks.form.content")}>
        <ContentFields values={values} set={setContent} error={error} />
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
          <CustomFieldInputs
            fields={options.fields}
            values={values.customValues}
            onChange={setCustom}
            error={error}
          />
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
