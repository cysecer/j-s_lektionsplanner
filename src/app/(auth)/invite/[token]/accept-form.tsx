"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";

const nameSchema = z.string().trim().min(1).max(100);

export function AcceptInvitationForm(props: {
  token: string;
  email: string;
  suggestedName: string;
  intro: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState(props.suggestedName);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(t(name.trim() ? "validation.tooLong" : "validation.required"));
      return;
    }
    setNameError(undefined);
    setBusy(true);
    const { error } = await authClient.$fetch("/invitation/accept", {
      method: "POST",
      body: { token: props.token, name: parsed.data },
    });
    if (error) {
      setBusy(false);
      setError(error.status === 429 ? t("auth.signIn.rateLimited") : t("auth.invitation.invalid"));
      return;
    }
    router.replace("/welcome");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("auth.invitation.title")}</CardTitle>
        <CardDescription className="text-base">{props.intro}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormField label={t("common.email")} value={props.email} readOnly disabled />
          <FormField
            label={t("auth.invitation.nameLabel")}
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
          />
          <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
            {t("auth.invitation.accept")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
