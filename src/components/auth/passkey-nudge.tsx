"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasskeySetupButton } from "./passkey-setup-button";

/** Shown to users without a passkey until they set one up or dismiss it. */
export function PasskeyNudge({ onLater }: { onLater?: () => void }) {
  const t = useTranslations("auth.passkeyPrompt");
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription className="text-base">{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <PasskeySetupButton size="lg" className="h-12 text-base" label={t("create")} />
        <Button
          variant="ghost"
          className="h-12"
          onClick={() => {
            setHidden(true);
            onLater?.();
          }}
        >
          {t("later")}
        </Button>
      </CardContent>
    </Card>
  );
}
