"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function RemovePasskeyButton({ id }: { id: string }) {
  const t = useTranslations("auth.account");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={busy}
      onClick={async () => {
        // Replaced by a proper confirmation dialog with the app shell (phase 4).
        if (!window.confirm(t("removePasskeyConfirm"))) return;
        setBusy(true);
        await authClient.passkey.deletePasskey({ id });
        setBusy(false);
        router.refresh();
      }}
    >
      {t("removePasskey")}
    </Button>
  );
}
