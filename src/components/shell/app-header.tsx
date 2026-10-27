import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Viewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { navItemsFor } from "./nav-items";
import { NavLinks } from "./nav-links";
import { TeamSwitcher } from "./team-switcher";
import { UserMenu } from "./user-menu";

export async function AppHeader({ viewer }: { viewer: Viewer }) {
  const t = await getTranslations();
  const teams = await db.team.findMany({
    where: { clubId: viewer.clubId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const items = navItemsFor(viewer.permissions);

  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        {t("nav.skipToContent")}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4">
        <MobileNav items={items} teams={teams} activeTeamId={viewer.activeTeamId} />
        <Link
          href="/lessons"
          className="mr-2 text-lg font-semibold tracking-tight whitespace-nowrap"
        >
          {t("app.name")}
        </Link>
        <nav aria-label={t("nav.main")} className="hidden md:block">
          <NavLinks items={items} />
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <TeamSwitcher
            teams={teams}
            activeTeamId={viewer.activeTeamId}
            className="hidden md:flex"
          />
          <LanguageSwitcher />
          <UserMenu name={viewer.name} roleLabel={t(`roles.${viewer.role}`)} />
        </div>
      </div>
    </header>
  );
}
