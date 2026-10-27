"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { firstFieldError } from "@/lib/i18n-keys";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [state, setState] = useState<"idle" | "busy" | "done" | "invalid">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("busy");
    const result = await resetPasswordAction({ token, newPassword: password });
    if (result.ok) return setState("done");
    const message = firstFieldError(t, result.fieldErrors, "newPassword", {
      min: PASSWORD_MIN_LENGTH,
      max: PASSWORD_MAX_LENGTH,
    });
    setFieldError(message);
    setState(message ? "idle" : "invalid");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>{t("auth.resetPassword.title")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {state === "done" ? (
          <>
            <Alert>
              <AlertDescription>{t("auth.resetPassword.done")}</AlertDescription>
            </Alert>
            <Button asChild className="h-11">
              <Link href="/login">{t("auth.signIn.title")}</Link>
            </Button>
          </>
        ) : (
          <form className="grid gap-4" onSubmit={submit} noValidate>
            {state === "invalid" ? (
              <Alert variant="destructive">
                <AlertDescription>{t("auth.resetPassword.invalid")}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              label={t("auth.account.newPassword")}
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldError}
              hint={t("password.tooShort", { min: PASSWORD_MIN_LENGTH })}
            />
            <Button type="submit" className="h-11 text-base" disabled={state === "busy"}>
              {t("auth.resetPassword.submit")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
