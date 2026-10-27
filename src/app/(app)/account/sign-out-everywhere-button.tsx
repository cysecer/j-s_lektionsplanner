"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { errorMessage } from "@/lib/i18n-keys";
import { signOutEverywhereAction } from "./actions";

export function SignOutEverywhereButton() {
  const t = useTranslations();
  const router = useRouter();
  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-sm">{t("auth.account.signOutEverywhereHint")}</p>
      <ConfirmDialog
        trigger={
          <Button variant="outline" className="h-11 w-full sm:w-auto">
            {t("auth.signOutEverywhere")}
          </Button>
        }
        description={t("auth.account.signOutEverywhereHint")}
        confirmLabel={t("auth.signOutEverywhere")}
        onConfirm={async () => {
          const result = await signOutEverywhereAction({});
          if (!result.ok) {
            toast.error(errorMessage(t, result.error));
            return;
          }
          // The session is gone server-side; this clears the cookie here.
          await authClient.signOut().catch(() => undefined);
          router.replace("/login");
          router.refresh();
        }}
      />
    </div>
  );
}
