"use client";

import { Fingerprint, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth/client";

const emailSchema = z.email().max(254);

type Mode = "link" | "password";
type Status =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "linkSent"; email: string }
  | { kind: "error"; message: string };

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [status, setStatus] = useState<Status>(
    linkError ? { kind: "error", message: t("auth.signIn.linkInvalid") } : { kind: "idle" },
  );
  const busy = status.kind === "busy";

  function failure(code: number | undefined, fallback: string) {
    setStatus({ kind: "error", message: code === 429 ? t("auth.signIn.rateLimited") : fallback });
  }

  async function signInWithPasskey() {
    setStatus({ kind: "busy" });
    const result = await authClient.signIn.passkey();
    if (result?.error) return failure(result.error.status, t("auth.signIn.passkeyFailed"));
    router.replace(next);
    router.refresh();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setEmailError(t("validation.email"));
      return;
    }
    setEmailError(undefined);
    setStatus({ kind: "busy" });

    if (mode === "link") {
      const { error } = await authClient.signIn.magicLink({
        email: parsed.data,
        callbackURL: next,
        errorCallbackURL: "/login",
      });
      // Same message whether or not the address exists.
      if (error?.status === 429) return failure(429, "");
      setStatus({ kind: "linkSent", email: parsed.data });
      return;
    }

    if (!password) {
      setStatus({ kind: "error", message: t("validation.required") });
      return;
    }
    const { error } = await authClient.signIn.email({ email: parsed.data, password });
    if (error) return failure(error.status, t("auth.signIn.failed"));
    router.replace(next);
    router.refresh();
  }

  if (status.kind === "linkSent") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>{t("auth.signIn.linkSentTitle")}</h1>
          </CardTitle>
          <CardDescription className="text-base">
            {t("auth.signIn.linkSent", { email: status.email })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => setStatus({ kind: "idle" })}
          >
            {t("common.back")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>{t("auth.signIn.title")}</h1>
        </CardTitle>
        <CardDescription className="text-base">{t("auth.signIn.intro")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {status.kind === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2">
          <Button size="lg" className="h-12 text-base" onClick={signInWithPasskey} disabled={busy}>
            <Fingerprint aria-hidden className="size-5" />
            {t("auth.signIn.withPasskey")}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            {t("auth.signIn.passkeyHint")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-sm">{t("common.or")}</span>
          <Separator className="flex-1" />
        </div>

        <form className="grid gap-4" onSubmit={submit} noValidate>
          <FormField
            label={t("common.email")}
            type="email"
            name="email"
            autoComplete="username webauthn"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          {mode === "password" ? (
            <FormField
              label={t("common.password")}
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
          <Button type="submit" variant="secondary" className="h-11 text-base" disabled={busy}>
            {mode === "link" ? <Mail aria-hidden className="size-5" /> : null}
            {mode === "link" ? t("auth.signIn.sendLink") : t("auth.signIn.submitPassword")}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 text-sm">
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "link" ? "password" : "link")}
          >
            {mode === "link" ? t("auth.signIn.usePassword") : t("auth.signIn.useLink")}
          </button>
          {mode === "password" ? (
            <Link
              href="/forgot-password"
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              {t("auth.signIn.forgotPassword")}
            </Link>
          ) : null}
          <p className="text-muted-foreground text-center">{t("auth.signIn.inviteOnly")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
