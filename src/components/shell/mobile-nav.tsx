"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavItem } from "./nav-items";
import { NavLinks } from "./nav-links";
import { TeamSwitcher } from "./team-switcher";

/** Phone/tablet portrait: navigation and team filter in a slide-in panel. */
export function MobileNav(props: {
  items: NavItem[];
  teams: { id: string; name: string }[];
  activeTeamId: string | null;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 md:hidden"
          aria-label={t("nav.openMenu")}
        >
          <Menu aria-hidden className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>{t("nav.menu")}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t("nav.main")} className="grid gap-6 px-4">
          <NavLinks items={props.items} orientation="vertical" onNavigate={() => setOpen(false)} />
          <TeamSwitcher teams={props.teams} activeTeamId={props.activeTeamId} className="w-full" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
