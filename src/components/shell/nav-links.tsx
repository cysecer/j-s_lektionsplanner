"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

export function NavLinks({
  items,
  orientation = "horizontal",
  onNavigate,
}: {
  items: NavItem[];
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className={cn("flex gap-1", orientation === "vertical" && "flex-col")}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center rounded-md px-3 text-base font-medium transition-colors",
                "hover:bg-accent focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                active ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
