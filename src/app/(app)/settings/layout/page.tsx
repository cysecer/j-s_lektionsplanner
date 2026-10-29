import { LayoutTemplate } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/page-header";
import { requireViewer } from "@/lib/auth/session";

export default async function LayoutSettingsPage() {
  await requireViewer("ADMIN");
  const t = await getTranslations("settings.layout");
  return (
    <div className="max-w-3xl">
      <EmptyState icon={<LayoutTemplate />} title={t("title")} description={t("comingSoon")} />
    </div>
  );
}
