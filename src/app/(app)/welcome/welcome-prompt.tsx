"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PasskeySetupButton } from "@/components/auth/passkey-setup-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WelcomePrompt() {
  const t = useTranslations("auth.passkeyPrompt");
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>{t("title")}</h1>
        </CardTitle>
        <CardDescription className="text-base">{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <PasskeySetupButton
          size="lg"
          className="h-12 w-full text-base"
          label={t("create")}
          onDone={() => router.replace("/")}
        />
        <Button variant="ghost" className="h-12" onClick={() => router.replace("/")}>
          {t("later")}
        </Button>
      </CardContent>
    </Card>
  );
}
