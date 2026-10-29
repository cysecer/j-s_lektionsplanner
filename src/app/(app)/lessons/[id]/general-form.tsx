"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { CheckboxGroup, Field } from "@/components/blocks/content-fields";
import { FormField } from "@/components/form-field";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Difficulty } from "@/generated/prisma/enums";
import { firstFieldError } from "@/lib/i18n-keys";
import type { LessonOptions } from "@/lib/lessons/queries";
import type { LessonGeneralValues } from "@/lib/lessons/schema";
import type { RichText } from "@/lib/rich-text/schema";
import type { FieldErrors } from "@/lib/server/result";

const selectClass =
  "border-input bg-background focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-3";

export function GeneralForm({
  values,
  onChange,
  options,
  fieldErrors,
}: {
  values: LessonGeneralValues;
  onChange: (patch: Partial<LessonGeneralValues>) => void;
  options: LessonOptions;
  fieldErrors: FieldErrors | undefined;
}) {
  const t = useTranslations();
  const ids = {
    team: useId(),
    difficulty: useId(),
    layout: useId(),
    coaches: useId(),
    safety: useId(),
    goals: useId(),
    notes: useId(),
  };
  const error = (path: string) => firstFieldError(t, fieldErrors, path);
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  // Coaches of the lesson's team first, then everyone else.
  const coaches = [...options.coaches].sort(
    (a, b) =>
      Number(b.teamIds.includes(values.teamId ?? "")) -
      Number(a.teamIds.includes(values.teamId ?? "")),
  );

  return (
    <Card>
      <CardContent className="grid gap-5">
        <h2 className="text-lg font-semibold">{t("lessons.general.heading")}</h2>
        <FormField
          label={t("lessons.general.title")}
          value={values.title}
          maxLength={150}
          onChange={(e) => onChange({ title: e.target.value })}
          error={error("title")}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            label={t("lessons.general.date")}
            type="date"
            value={values.date}
            onChange={(e) => onChange({ date: e.target.value })}
            error={error("date")}
          />
          <FormField
            label={t("lessons.general.startTime")}
            type="time"
            step={300}
            value={str(values.startTime)}
            onChange={(e) => onChange({ startTime: e.target.value })}
            hint={t("lessons.general.startTimeHint")}
            error={error("startTime")}
          />
          <FormField
            label={t("lessons.general.totalDuration")}
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            step={5}
            value={str(values.totalDurationMinutes)}
            onChange={(e) => onChange({ totalDurationMinutes: e.target.value })}
            error={error("totalDurationMinutes")}
          />
          <div className="grid content-start gap-2">
            <Label htmlFor={ids.team}>{t("lessons.general.team")}</Label>
            <select
              id={ids.team}
              value={values.teamId ?? ""}
              onChange={(e) => onChange({ teamId: e.target.value || null })}
              className={selectClass}
            >
              <option value="">{t("lessons.general.noTeam")}</option>
              {options.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {options.coaches.length > 0 ? (
          <CheckboxGroup
            id={ids.coaches}
            label={t("lessons.general.presentCoaches")}
            items={coaches}
            selected={values.presentCoachIds}
            onChange={(presentCoachIds) => onChange({ presentCoachIds })}
          />
        ) : null}

        <details className="group rounded-lg border">
          <summary className="hover:bg-accent flex min-h-11 cursor-pointer items-center px-4 font-medium">
            {t("lessons.general.more")}
          </summary>
          <div className="grid gap-5 border-t p-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                label={t("lessons.general.author")}
                value={values.authorName}
                maxLength={100}
                onChange={(e) => onChange({ authorName: e.target.value })}
                error={error("authorName")}
              />
              <FormField
                label={t("lessons.general.location")}
                value={str(values.location)}
                maxLength={120}
                onChange={(e) => onChange({ location: e.target.value })}
                error={error("location")}
              />
              <FormField
                label={t("lessons.general.groupSize")}
                value={str(values.groupSize)}
                maxLength={60}
                onChange={(e) => onChange({ groupSize: e.target.value })}
                error={error("groupSize")}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label={t("lessons.general.ageMin")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  value={str(values.ageMin)}
                  onChange={(e) => onChange({ ageMin: e.target.value })}
                  error={error("ageMin")}
                />
                <FormField
                  label={t("lessons.general.ageMax")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  value={str(values.ageMax)}
                  onChange={(e) => onChange({ ageMax: e.target.value })}
                  error={error("ageMax")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={ids.difficulty}>{t("lessons.general.difficulty")}</Label>
                <select
                  id={ids.difficulty}
                  value={values.difficulty ?? ""}
                  onChange={(e) =>
                    onChange({ difficulty: (e.target.value || null) as Difficulty | null })
                  }
                  className={selectClass}
                >
                  <option value="">{t("lessons.general.noDifficulty")}</option>
                  {Object.values(Difficulty).map((d) => (
                    <option key={d} value={d}>
                      {t(`difficulty.${d}`)}
                    </option>
                  ))}
                </select>
              </div>
              {options.layouts.length > 1 ? (
                <div className="grid gap-2">
                  <Label htmlFor={ids.layout}>{t("lessons.general.layout")}</Label>
                  <select
                    id={ids.layout}
                    value={values.layoutId ?? ""}
                    onChange={(e) => onChange({ layoutId: e.target.value || null })}
                    className={selectClass}
                  >
                    {options.layouts.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <Field id={ids.goals} label={t("lessons.general.goals")} error={error("goals")}>
              <RichTextEditor
                labelledBy={ids.goals}
                value={values.goals as RichText | null}
                onChange={(goals) => onChange({ goals })}
              />
            </Field>
            <Field id={ids.notes} label={t("lessons.general.notes")} error={error("notes")}>
              <RichTextEditor
                labelledBy={ids.notes}
                value={values.notes as RichText | null}
                onChange={(notes) => onChange({ notes })}
              />
            </Field>
            <Field id={ids.safety} label={t("lessons.general.safety")} error={error("safety")}>
              <RichTextEditor
                labelledBy={ids.safety}
                value={values.safety as RichText | null}
                onChange={(safety) => onChange({ safety })}
              />
            </Field>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
