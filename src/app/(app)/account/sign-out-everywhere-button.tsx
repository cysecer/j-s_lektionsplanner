"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { errorMessage } from "@/lib/i18n-keys";
import { signOutEverywhereAction } from "./actions";

export function SignOutEverywhereButton() {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-sm">{t("auth.account.signOutEverywhereHint")}</p>
      <Button
        variant="outline"
        className="h-11 w-full sm:w-auto"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await signOutEverywhereAction({});
          if (!result.ok) {
            setBusy(false);
            setError(errorMessage(t, result.error));
            return;
          }
          // The session is gone server-side; this clears the cookie here.
          await authClient.signOut().catch(() => undefined);
          router.replace("/login");
          router.refresh();
        }}
      >
        {t("auth.signOutEverywhere")}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
