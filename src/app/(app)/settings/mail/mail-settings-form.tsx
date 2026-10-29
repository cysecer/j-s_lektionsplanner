"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { SmtpSecurity } from "@/generated/prisma/enums";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import { deleteMailSettingsAction, saveMailSettingsAction, sendTestMailAction } from "./actions";

type Values = {
  host: string;
  port: string;
  security: SmtpSecurity;
  username: string;
  fromEmail: string;
  fromName: string;
};

/** Usual port per encryption; switched along unless the admin chose another. */
const DEFAULT_PORT: Record<SmtpSecurity, string> = { TLS: "465", STARTTLS: "587", NONE: "1025" };

export function MailSettingsForm({
  configured,
  fallback,
  allowInsecure,
  clubName,
  adminEmail,
  password,
  initial,
}: {
  configured: boolean;
  /** Host of the server-wide fallback (SMTP_HOST), if any. */
  fallback: string | null;
  allowInsecure: boolean;
  clubName: string;
  adminEmail: string;
  password: "none" | "stored" | "lost";
  initial: Values;
}) {
  const t = useTranslations();
  const securityLabelId = useId();
  const [values, setValues] = useState(initial);
  const [newPassword, setNewPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const save = useAction(saveMailSettingsAction);
  const test = useAction(sendTestMailAction);
  const remove = useAction(deleteMailSettingsAction);
  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const error = (field: string) => firstFieldError(t, save.fieldErrors, field);
  const securities: SmtpSecurity[] = allowInsecure
    ? ["TLS", "STARTTLS", "NONE"]
    : ["TLS", "STARTTLS"];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await save.run(
      { ...values, password: newPassword, clearPassword },
      {
        success: t("common.saved"),
        labels: {
          host: t("settings.mail.host"),
          port: t("settings.mail.port"),
          security: t("settings.mail.security"),
          username: t("settings.mail.username"),
          password: t("settings.mail.password"),
          fromEmail: t("settings.mail.fromEmail"),
          fromName: t("settings.mail.fromName"),
        },
      },
    );
    if (saved !== undefined) {
      setNewPassword("");
      setClearPassword(false);
    }
  }

  async function sendTest() {
    const result = await test.run({});
    if (result) toast.success(t("settings.mail.test.sent", { email: result.to }));
  }

  return (
    <div className="grid gap-6">
      <Alert>
        <AlertDescription role="status">
          {configured
            ? t("settings.mail.statusClub")
            : fallback
              ? t("settings.mail.statusFallback", { host: fallback })
              : t("settings.mail.statusNone")}
        </AlertDescription>
      </Alert>

      <form className="grid gap-5" onSubmit={submit} noValidate>
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <FormField
            label={t("settings.mail.host")}
            value={values.host}
            onChange={set("host")}
            placeholder="mail.example.ch"
            autoComplete="off"
            spellCheck={false}
            maxLength={253}
            required
            error={error("host")}
          />
          <FormField
            label={t("settings.mail.port")}
            type="number"
            inputMode="numeric"
            value={values.port}
            onChange={set("port")}
            required
            error={error("port")}
          />
        </div>
        <div className="grid gap-2">
          <Label id={securityLabelId}>{t("settings.mail.security")}</Label>
          <Select
            value={values.security}
            onValueChange={(security) =>
              setValues((v) => ({
                ...v,
                security: security as SmtpSecurity,
                port:
                  v.port === DEFAULT_PORT[v.security] || v.port === ""
                    ? DEFAULT_PORT[security as SmtpSecurity]
                    : v.port,
              }))
            }
          >
            <SelectTrigger
              size="lg"
              aria-labelledby={securityLabelId}
              aria-invalid={error("security") ? true : undefined}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {securities.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`settings.mail.securities.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error("security") ? (
            <p className="text-destructive text-sm" role="alert">
              {error("security")}
            </p>
          ) : null}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={`${t("settings.mail.username")} (${t("common.optional")})`}
            value={values.username}
            onChange={set("username")}
            autoComplete="off"
            spellCheck={false}
            maxLength={254}
            error={error("username")}
          />
          <FormField
            label={t("settings.mail.password")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            // Keeps browsers from filling in the admin's own login password.
            autoComplete="new-password"
            maxLength={256}
            disabled={clearPassword || values.username.trim() === ""}
            placeholder={password === "stored" ? t("settings.mail.passwordStored") : undefined}
            hint={
              password === "stored"
                ? t("settings.mail.passwordKeepHint")
                : t("settings.mail.passwordHint")
            }
            error={error("password")}
          />
        </div>
        {password === "lost" ? (
          <Alert variant="destructive">
            <AlertDescription>{t("settings.mail.passwordLost")}</AlertDescription>
          </Alert>
        ) : null}
        {password !== "none" ? (
          <Label className="flex min-h-11 items-center gap-3 font-normal">
            <Checkbox
              checked={clearPassword}
              onCheckedChange={(v) => {
                setClearPassword(v === true);
                if (v === true) setNewPassword("");
              }}
            />
            {t("settings.mail.clearPassword")}
          </Label>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={t("settings.mail.fromEmail")}
            type="email"
            value={values.fromEmail}
            onChange={set("fromEmail")}
            placeholder="noreply@example.ch"
            maxLength={254}
            required
            hint={t("settings.mail.fromEmailHint")}
            error={error("fromEmail")}
          />
          <FormField
            label={`${t("settings.mail.fromName")} (${t("common.optional")})`}
            value={values.fromName}
            onChange={set("fromName")}
            placeholder={clubName}
            maxLength={80}
            error={error("fromName")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11" disabled={save.pending}>
            {t("common.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={test.pending || (!configured && !fallback)}
            onClick={() => void sendTest()}
          >
            {test.pending ? t("settings.mail.test.sending") : t("settings.mail.test.button")}
          </Button>
          {configured ? (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" className="text-destructive h-11">
                  {t("settings.mail.remove")}
                </Button>
              }
              description={t("settings.mail.removeConfirm")}
              confirmLabel={t("settings.mail.remove")}
              onConfirm={async () => {
                await remove.run({}, { success: t("settings.mail.removed") });
              }}
            />
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          {t("settings.mail.test.hint", { email: adminEmail })}
        </p>
      </form>
    </div>
  );
}
