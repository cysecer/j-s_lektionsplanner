"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { createLessonAction } from "./actions";

/** Creates a draft right away (so autosave works from the first keystroke). */
export function NewLessonButton() {
  const t = useTranslations("lessons");
  const router = useRouter();
  const create = useAction(createLessonAction);
  return (
    <Button
      className="h-11"
      disabled={create.pending}
      onClick={async () => {
        const lesson = await create.run({});
        if (lesson) router.push(`/lessons/${lesson.id}`);
      }}
    >
      <Plus aria-hidden />
      {t("new")}
    </Button>
  );
}
