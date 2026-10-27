import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/page-header";
import { requireViewer } from "@/lib/auth/session";

export default async function SettingsPage() {
  await requireViewer("ADMIN");
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <EmptyState icon={<Settings />} title={t("comingSoon")} />
    </>
  );
}
