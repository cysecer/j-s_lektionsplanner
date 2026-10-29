"use client";

import { Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { deleteBlockAction, duplicateBlockAction } from "../actions";

export function BlockActions({ id, title }: { id: string; title: string }) {
  const t = useTranslations();
  const router = useRouter();
  const duplicate = useAction(duplicateBlockAction);
  const remove = useAction(deleteBlockAction);

  return (
    <>
      <Button
        variant="outline"
        className="h-11"
        disabled={duplicate.pending}
        onClick={async () => {
          const copy = await duplicate.run({ id }, { success: t("blocks.duplicated") });
          if (copy) router.push(`/blocks/${copy.id}/edit`);
        }}
      >
        <Copy aria-hidden />
        {t("blocks.duplicate")}
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="outline" className="h-11">
            <Trash2 aria-hidden />
            {t("common.delete")}
          </Button>
        }
        description={t("blocks.deleteConfirm", { name: title })}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if ((await remove.run({ id })) !== undefined) {
            toast.success(t("blocks.deleted", { name: title }));
            router.push("/blocks");
          }
        }}
      />
    </>
  );
}
