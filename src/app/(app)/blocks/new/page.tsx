import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requireViewer } from "@/lib/auth/session";
import { EMPTY_BLOCK } from "@/lib/blocks/form-values";
import { getBlockOptions } from "@/lib/blocks/queries";
import { BlockForm } from "../block-form";

export default async function NewBlockPage() {
  const viewer = await requireViewer("COACH");
  const t = await getTranslations("blocks");
  const options = await getBlockOptions(viewer.clubId, viewer.teams, "edit");
  // New blocks belong to the team chosen in the header, if any.
  const initial = {
    ...EMPTY_BLOCK,
    teamIds: options.teams.some((x) => x.id === viewer.activeTeamId) ? [viewer.activeTeamId!] : [],
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("newTitle")} />
      <BlockForm initial={initial} options={options} />
    </div>
  );
}
