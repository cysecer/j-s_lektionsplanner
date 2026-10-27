"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function RemovePasskeyButton({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="h-11">
          {t("auth.account.removePasskey")}
        </Button>
      }
      description={t("auth.account.removePasskeyConfirm")}
      confirmLabel={t("auth.account.removePasskey")}
      onConfirm={async () => {
        const { error } = await authClient.passkey.deletePasskey({ id });
        if (error) toast.error(t("errors.internal"));
        router.refresh();
      }}
    />
  );
}
