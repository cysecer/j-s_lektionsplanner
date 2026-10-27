import type { Permissions } from "@/lib/auth/roles";

export type NavItem = {
  href: "/lessons" | "/blocks" | "/settings";
  labelKey: "lessons" | "blocks" | "settings";
};

export function navItemsFor(permissions: Permissions): NavItem[] {
  const items: NavItem[] = [
    { href: "/lessons", labelKey: "lessons" },
    { href: "/blocks", labelKey: "blocks" },
  ];
  if (permissions.manageSettings) items.push({ href: "/settings", labelKey: "settings" });
  return items;
}
