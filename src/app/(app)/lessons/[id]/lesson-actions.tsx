"use client";

import { Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { deleteLessonAction, duplicateLessonAction } from "../actions";

export function LessonActions({ lessonId, title }: { lessonId: string; title: string }) {
  const t = useTranslations("lessons");
  const router = useRouter();
  const duplicate = useAction(duplicateLessonAction);
  const remove = useAction(deleteLessonAction);
  return (
    <>
      <Button
        variant="outline"
        className="h-11"
        disabled={duplicate.pending}
        onClick={async () => {
          const copy = await duplicate.run({ id: lessonId }, { success: t("duplicated") });
          if (copy) router.push(`/lessons/${copy.id}`);
        }}
      >
        <Copy aria-hidden />
        {t("duplicate")}
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="outline" className="h-11">
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
        }
        description={t("deleteConfirm", { name: title })}
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if ((await remove.run({ id: lessonId })) !== undefined) {
            toast.success(t("deleted", { name: title }));
            router.push("/lessons");
          }
        }}
      />
    </>
  );
}
