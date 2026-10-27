"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasskeySetupButton } from "./passkey-setup-button";

/** Per-device "later" choice; the banner returns after 30 days. */
export const PASSKEY_NUDGE_COOKIE = "passkey_nudge";

/** Shown to users without a passkey until they set one up or postpone it. */
export function PasskeyNudge() {
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
            document.cookie = `${PASSKEY_NUDGE_COOKIE}=dismissed; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
            setHidden(true);
          }}
        >
          {t("later")}
        </Button>
      </CardContent>
    </Card>
  );
}
