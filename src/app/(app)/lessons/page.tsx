import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PasskeyNudgeSlot } from "@/components/auth/passkey-nudge-slot";
import { EmptyState, PageHeader } from "@/components/page-header";
import { requireViewer } from "@/lib/auth/session";

export default async function LessonsPage() {
  const viewer = await requireViewer();
  const t = await getTranslations("lessons");
  return (
    <>
      <PasskeyNudgeSlot viewer={viewer} />
      <PageHeader title={t("title")} description={t("intro")} />
      <EmptyState icon={<ClipboardList />} title={t("comingSoon")} />
    </>
  );
}
