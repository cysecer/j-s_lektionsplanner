"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const t = useTranslations("auth");
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="h-11"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut aria-hidden className="size-5" />
      <span className="sr-only sm:not-sr-only">{t("signOut")}</span>
    </Button>
  );
}
