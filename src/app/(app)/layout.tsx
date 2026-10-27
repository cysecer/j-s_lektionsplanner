import { UserRound } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireViewer } from "@/lib/auth/session";

// Minimal header; navigation, team and language switcher follow in phase 4.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer();
  const t = await getTranslations();
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {t("app.name")}
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/account"
              className="hover:bg-accent inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium"
            >
              <UserRound aria-hidden className="size-5" />
              <span className="sr-only sm:not-sr-only">{viewer.name}</span>
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
