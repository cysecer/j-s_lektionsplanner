"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";

export function UserMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11" aria-label={t("header.signedInAs", { name })}>
          <UserRound aria-hidden className="size-5" />
          <span className="sr-only md:not-sr-only">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="grid">
          <span>{name}</span>
          <span className="text-muted-foreground text-xs font-normal">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-10">
          <Link href="/account">
            <UserRound aria-hidden />
            {t("nav.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-10"
          onSelect={async () => {
            await authClient.signOut();
            router.replace("/login");
            router.refresh();
          }}
        >
          <LogOut aria-hidden />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
