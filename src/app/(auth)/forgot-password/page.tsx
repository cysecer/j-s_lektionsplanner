"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "rateLimited">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = z.email().max(254).safeParse(email.trim());
    if (!parsed.success) {
      setEmailError(t("validation.email"));
      return;
    }
    setEmailError(undefined);
    setState("busy");
    const { error } = await authClient.requestPasswordReset({
      email: parsed.data,
      redirectTo: "/reset-password",
    });
    setState(error?.status === 429 ? "rateLimited" : "sent");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>{t("auth.forgotPassword.title")}</h1>
        </CardTitle>
        <CardDescription className="text-base">{t("auth.forgotPassword.intro")}</CardDescription>
      </CardHeader>
      <CardContent>
        {state === "sent" ? (
          <Alert>
            <AlertDescription>{t("auth.forgotPassword.sent")}</AlertDescription>
          </Alert>
        ) : (
          <form className="grid gap-4" onSubmit={submit} noValidate>
            {state === "rateLimited" ? (
              <Alert variant="destructive">
                <AlertDescription>{t("auth.signIn.rateLimited")}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              label={t("common.email")}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
            <Button type="submit" className="h-11 text-base" disabled={state === "busy"}>
              {t("auth.forgotPassword.submit")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
