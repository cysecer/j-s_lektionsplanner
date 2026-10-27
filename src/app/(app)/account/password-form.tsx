"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { errorMessage, firstFieldError } from "@/lib/i18n-keys";
import type { FieldErrors } from "@/lib/server/result";
import { changePasswordAction, setPasswordAction } from "./actions";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<FieldErrors>();
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  const limits = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(undefined);
    const result = hasPassword
      ? await changePasswordAction({ currentPassword: current, newPassword: next })
      : await setPasswordAction({ newPassword: next });
    setBusy(false);
    if (result.ok) {
      setErrors(undefined);
      setCurrent("");
      setNext("");
      setStatus({ ok: true, text: t("auth.account.passwordSaved") });
      router.refresh();
      return;
    }
    setErrors(result.fieldErrors);
    if (!result.fieldErrors) setStatus({ ok: false, text: errorMessage(t, result.error) });
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      {hasPassword ? (
        <FormField
          label={t("auth.account.currentPassword")}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={firstFieldError(t, errors, "currentPassword", limits)}
        />
      ) : null}
      <FormField
        label={t("auth.account.newPassword")}
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={firstFieldError(t, errors, "newPassword", limits)}
        hint={t("password.tooShort", limits)}
      />
      <Button type="submit" variant="secondary" className="h-11 w-full sm:w-auto" disabled={busy}>
        {hasPassword ? t("auth.account.changePassword") : t("auth.account.setPassword")}
      </Button>
      {status ? (
        <p
          role="status"
          className={status.ok ? "text-sm text-green-700" : "text-destructive text-sm"}
        >
          {status.text}
        </p>
      ) : null}
    </form>
  );
}
