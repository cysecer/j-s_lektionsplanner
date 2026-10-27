"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/i18n-keys";
import { signOutEverywhereAction } from "./actions";

export function SignOutEverywhereButton() {
  const t = useTranslations();
  const [message, setMessage] = useState<string>();
  return (
    <div className="grid gap-2">
      <Button
        variant="outline"
        className="h-11 w-full sm:w-auto"
        onClick={async () => {
          const result = await signOutEverywhereAction({});
          setMessage(
            result.ok ? t("auth.account.signedOutEverywhere") : errorMessage(t, result.error),
          );
        }}
      >
        {t("auth.signOutEverywhere")}
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
