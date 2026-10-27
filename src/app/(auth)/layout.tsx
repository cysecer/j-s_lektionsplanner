import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shell/language-switcher";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app");
  return (
    <>
      <header className="flex justify-end px-4 pt-4">
        <LanguageSwitcher showName />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-10">
        <p className="text-xl font-semibold tracking-tight">{t("name")}</p>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </>
  );
}
