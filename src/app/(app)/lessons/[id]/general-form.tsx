"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import { CheckboxGroup, Field } from "@/components/blocks/content-fields";
import { DateField, TimeField } from "@/components/date-time-fields";
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

const alignedField = "grid content-start gap-2 sm:row-span-3 sm:grid-rows-subgrid";

const selectClass =
  "border-input bg-background focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm";

export function GeneralForm({
  values,
  onChange,
  options,
  fieldErrors,
  creator,
  privateDraft,
}: {
  values: LessonGeneralValues;
  onChange: (patch: Partial<LessonGeneralValues>) => void;
  options: LessonOptions;
  fieldErrors: FieldErrors | undefined;
  creator: { name: string | null; createdAt: string };
  /** Draft in a team whose drafts only the creator sees. */
  privateDraft: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();
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
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("lessons.general.heading")}</h2>
          <p className="text-muted-foreground text-sm">
            {creator.name
              ? t("lessons.general.createdBy", {
                  name: creator.name,
                  date: format.dateTime(new Date(creator.createdAt), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }),
                })
              : t("lessons.general.createdByUnknown")}
            {privateDraft ? ` · ${t("lessons.general.privateDraft")}` : null}
          </p>
        </div>
        <FormField
          label={t("lessons.general.title")}
          value={values.title}
          maxLength={150}
          onChange={(e) => onChange({ title: e.target.value })}
          error={error("title")}
        />
        {/* Label, field and hint each share one row across the four fields
            (subgrid), so all fields line up even when a label wraps. */}
        <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-4 max-sm:[&>*+*]:mt-3 sm:max-lg:[&>*:nth-child(n+3)]:mt-3">
          <DateField
            label={t("lessons.general.date")}
            value={values.date}
            onChange={(date) => onChange({ date })}
            error={error("date")}
            wrapperClassName={alignedField}
          />
          <TimeField
            label={t("lessons.general.startTime")}
            value={str(values.startTime)}
            onChange={(startTime) => onChange({ startTime })}
            hint={t("lessons.general.startTimeHint")}
            error={error("startTime")}
            wrapperClassName={alignedField}
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
            wrapperClassName={alignedField}
          />
          <div className={alignedField}>
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
