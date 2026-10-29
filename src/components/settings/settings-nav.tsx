"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ITEMS = [
  "club",
  "teams",
  "coaches",
  "people",
  "tags",
  "sections",
  "fields",
  "layout",
] as const;

export function SettingsNav() {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b">
        {ITEMS.map((item) => {
          const href = `/settings/${item}`;
          const active = pathname === href;
          return (
            <li key={item}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap",
                  "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                  active
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {t(item)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
