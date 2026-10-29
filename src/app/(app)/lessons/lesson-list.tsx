"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAction } from "@/lib/use-action";
import { useSyncedState } from "@/lib/use-synced-state";
import { deleteLessonAction, deleteLessonsAction } from "./actions";

export type LessonRow = {
  id: string;
  title: string;
  /** "Mi 28.11.2018", formatted on the server. */
  date: string;
  time: string | null;
  meta: string;
  createdByName: string | null;
  status: "DRAFT" | "FINAL";
  /** The person coaches the lesson's team. */
  canDelete: boolean;
};

/**
 * The lesson list. Coaches delete single lessons of their teams; admins can also select
 * several (or all on the page) and delete them together.
 */
export function LessonList({ lessons, canSelect }: { lessons: LessonRow[]; canSelect: boolean }) {
  const t = useTranslations("lessons");
  const [rows, setRows] = useSyncedState(lessons);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const removeOne = useAction(deleteLessonAction);
  const removeMany = useAction(deleteLessonsAction);

  const visibleSelected = rows.filter((r) => selected.has(r.id));
  const allSelected = rows.length > 0 && visibleSelected.length === rows.length;
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="grid gap-3">
      {canSelect && rows.length > 0 ? (
        <div className="flex min-h-11 flex-wrap items-center gap-3">
          <label className="flex min-h-11 items-center gap-3 px-4 text-sm font-medium">
            <Checkbox
              checked={allSelected ? true : visibleSelected.length > 0 ? "indeterminate" : false}
              onCheckedChange={(v) =>
                setSelected(v === true ? new Set(rows.map((r) => r.id)) : new Set())
              }
            />
            {t("selectAll")}
          </label>
          {visibleSelected.length > 0 ? (
            <ConfirmDialog
              trigger={
                <Button variant="destructive" className="h-11">
                  <Trash2 aria-hidden />
                  {t("deleteSelected", { count: visibleSelected.length })}
                </Button>
              }
              description={t("deleteSelectedConfirm", { count: visibleSelected.length })}
              confirmLabel={t("deleteSelected", { count: visibleSelected.length })}
              onConfirm={async () => {
                const ids = visibleSelected.map((r) => r.id);
                const result = await removeMany.run({ ids });
                if (result) {
                  setRows((all) => all.filter((r) => !ids.includes(r.id)));
                  setSelected(new Set());
                  toast.success(t("deletedMany", { count: result.count }));
                }
              }}
            />
          ) : null}
        </div>
      ) : null}

      <ul className="divide-y rounded-xl border">
        {rows.map((lesson) => (
          <li
            key={lesson.id}
            className="hover:bg-accent/40 has-[[data-state=checked]]:bg-accent/60 flex items-center gap-1 pr-1"
          >
            {canSelect ? (
              <label className="flex size-11 shrink-0 items-center justify-center self-stretch pl-2">
                <Checkbox
                  checked={selected.has(lesson.id)}
                  onCheckedChange={(v) => toggle(lesson.id, v === true)}
                  aria-label={t("selectLesson", { name: lesson.title })}
                />
              </label>
            ) : null}
            <Link
              href={`/lessons/${lesson.id}`}
              className="focus-visible:ring-ring/50 flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-3 outline-none focus-visible:ring-3"
            >
              <span className="w-32 shrink-0 tabular-nums">
                {lesson.date}
                {lesson.time ? (
                  <span className="text-muted-foreground block text-sm">{lesson.time}</span>
                ) : null}
              </span>
              <span className="grid min-w-40 flex-1 gap-0.5">
                <span className="font-medium">{lesson.title}</span>
                <span className="text-muted-foreground text-sm">
                  {[
                    lesson.meta,
                    lesson.createdByName ? t("createdBy", { name: lesson.createdByName }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <Badge variant={lesson.status === "FINAL" ? "default" : "secondary"}>
                {t(`status.${lesson.status}`)}
              </Badge>
            </Link>
            {lesson.canDelete ? (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    aria-label={`${lesson.title}: ${t("delete")}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                description={t("deleteConfirm", { name: lesson.title })}
                confirmLabel={t("delete")}
                onConfirm={async () => {
                  if ((await removeOne.run({ id: lesson.id })) !== undefined) {
                    setRows((all) => all.filter((r) => r.id !== lesson.id));
                    toggle(lesson.id, false);
                    toast.success(t("deleted", { name: lesson.title }));
                  }
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
