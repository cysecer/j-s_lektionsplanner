import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { requireViewer } from "@/lib/auth/session";
import { canEditBlock } from "@/lib/auth/team-access";
import { visibleBlocksWhere } from "@/lib/lessons/visibility";
import { blockToFormValues } from "@/lib/blocks/form-values";
import { getBlock, getBlockOptions } from "@/lib/blocks/queries";
import { parsePageInput } from "@/lib/server/params";
import { BlockForm } from "../../block-form";

export default async function EditBlockPage({ params }: PageProps<"/blocks/[id]/edit">) {
  const viewer = await requireViewer("COACH");
  const { id } = await parsePageInput(z.object({ id: z.uuid() }), params);
  const [block, options, t] = await Promise.all([
    getBlock(visibleBlocksWhere(viewer), id),
    getBlockOptions(viewer.clubId, viewer.teams, "edit"),
    getTranslations("blocks"),
  ]);
  if (!block) notFound();
  if (
    !canEditBlock(
      viewer.teams,
      block.teams.map((x) => x.teamId),
    )
  )
    redirect(`/blocks/${id}`);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("editTitle")} description={block.title} />
      <BlockForm
        blockId={block.id}
        initial={blockToFormValues(
          block,
          options.fields.map((f) => f.id),
        )}
        options={options}
      />
    </div>
  );
}
