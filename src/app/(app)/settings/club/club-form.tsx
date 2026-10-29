"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { TimeField } from "@/components/date-time-fields";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import { updateClubAction } from "./actions";

type Values = {
  name: string;
  pdfFooterText: string;
  defaultStartTime: string;
  defaultDurationMinutes: string;
  readerPdfDailyLimit: string;
};

export function ClubForm({ initial }: { initial: Values }) {
  const t = useTranslations();
  const [values, setValues] = useState(initial);
  const { run, pending, fieldErrors } = useAction(updateClubAction);
  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const error = (field: keyof Values) => firstFieldError(t, fieldErrors, field);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(values, {
      success: t("common.saved"),
      labels: {
        name: t("settings.club.name"),
        pdfFooterText: t("settings.club.footer"),
        defaultStartTime: t("settings.club.defaultStartTime"),
        defaultDurationMinutes: t("settings.club.defaultDuration"),
        readerPdfDailyLimit: t("settings.club.readerPdfLimit"),
      },
    });
  }

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <FormField
        label={t("settings.club.name")}
        value={values.name}
        onChange={set("name")}
        maxLength={100}
        required
        error={error("name")}
      />
      <FormField
        label={`${t("settings.club.footer")} (${t("common.optional")})`}
        value={values.pdfFooterText}
        onChange={set("pdfFooterText")}
        maxLength={120}
        hint={t("settings.club.footerHint")}
        error={error("pdfFooterText")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TimeField
          label={t("settings.club.defaultStartTime")}
          value={values.defaultStartTime}
          onChange={(defaultStartTime) => setValues((v) => ({ ...v, defaultStartTime }))}
          required
          hint={t("settings.club.defaultStartTimeHint")}
          error={error("defaultStartTime")}
        />
        <FormField
          label={`${t("settings.club.defaultDuration")} (${t("common.minutes")})`}
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          step={5}
          value={values.defaultDurationMinutes}
          onChange={set("defaultDurationMinutes")}
          required
          hint={t("settings.club.defaultDurationHint")}
          error={error("defaultDurationMinutes")}
        />
      </div>
      <FormField
        label={t("settings.club.readerPdfLimit")}
        type="number"
        inputMode="numeric"
        min={0}
        max={1000}
        value={values.readerPdfDailyLimit}
        onChange={set("readerPdfDailyLimit")}
        required
        className="sm:max-w-xs"
        hint={t("settings.club.readerPdfLimitHint")}
        error={error("readerPdfDailyLimit")}
      />
      <div>
        <Button type="submit" className="h-11" disabled={pending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
