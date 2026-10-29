import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireViewer } from "@/lib/auth/session";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  await requireViewer("ADMIN");
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <SettingsNav />
      {children}
    </>
  );
}
