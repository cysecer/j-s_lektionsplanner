"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { MoveButtons, moveItem } from "@/components/move-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BuiltinSection } from "@/generated/prisma/enums";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import { useSyncedState } from "@/lib/use-synced-state";
import {
  createSectionAction,
  deleteSectionAction,
  reorderSectionsAction,
  updateSectionAction,
} from "./actions";

type Section = { id: string; builtin: BuiltinSection | null; name: string | null; inUse: boolean };

export function SectionsEditor({ sections }: { sections: Section[] }) {
  const t = useTranslations();
  const [order, setOrder] = useSyncedState(sections);
  const [name, setName] = useState("");
  const create = useAction(createSectionAction);
  const reorder = useAction(reorderSectionsAction);
  const remove = useAction(deleteSectionAction);
  const display = (s: Section) => s.name ?? (s.builtin ? t(`sections.${s.builtin}`) : "");

  async function add(event: FormEvent) {
    event.preventDefault();
    if ((await create.run({ name })) !== undefined) setName("");
  }

  return (
    <div className="grid gap-6">
      <ul className="divide-y rounded-lg border">
        {order.map((section, index) => (
          <li key={section.id} className="flex flex-wrap items-center gap-2 p-2 pl-4">
            <p className="min-w-40 flex-1 font-medium">
              {display(section)}
              {section.builtin ? (
                <Badge variant="secondary" className="ml-2 align-middle">
                  {t("settings.sections.standard")}
                </Badge>
              ) : null}
            </p>
            <MoveButtons
              index={index}
              count={order.length}
              label={display(section)}
              disabled={reorder.pending}
              onMove={(from, to) => {
                const next = moveItem(order, from, to);
                setOrder(next);
                void reorder.run({ ids: next.map((s) => s.id) });
              }}
            />
            <RenameSection section={section} />
            {!section.builtin && !section.inUse ? (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${display(section)}: ${t("common.delete")}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                description={t("settings.sections.deleteConfirm", { name: display(section) })}
                confirmLabel={t("common.delete")}
                onConfirm={async () => {
                  await remove.run({ id: section.id });
                }}
              />
            ) : (
              <span className="size-11" aria-hidden />
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-2">
        <FormField
          label={t("settings.sections.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="h-11 min-w-56"
          error={firstFieldError(t, create.fieldErrors, "name")}
        />
        <Button type="submit" className="h-11" disabled={create.pending}>
          <Plus aria-hidden />
          {t("settings.sections.add")}
        </Button>
      </form>
    </div>
  );
}

function RenameSection({ section }: { section: Section }) {
  const t = useTranslations();
  const [name, setName] = useState(section.name ?? "");
  const update = useAction(updateSectionAction);
  const defaultName = section.builtin ? t(`sections.${section.builtin}`) : "";
  return (
    <FormDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`${section.name ?? defaultName}: ${t("common.edit")}`}
        >
          <Pencil aria-hidden />
        </Button>
      }
      title={t("common.edit")}
      pending={update.pending}
      onOpen={() => {
        setName(section.name ?? "");
        update.clearErrors();
      }}
      onSubmit={async () => (await update.run({ id: section.id, name })) !== undefined}
    >
      <FormField
        label={t("settings.sections.name")}
        value={name}
        placeholder={defaultName}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoFocus
        hint={
          section.builtin ? t("settings.sections.builtinHint", { name: defaultName }) : undefined
        }
        error={firstFieldError(t, update.fieldErrors, "name")}
      />
    </FormDialog>
  );
}
