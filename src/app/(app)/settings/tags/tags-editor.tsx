"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import { createTagAction, deleteTagAction, updateTagAction } from "./actions";

type Tag = { id: string; name: string; usage: number };

export function TagsEditor({ tags }: { tags: Tag[] }) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const create = useAction(createTagAction);
  const remove = useAction(deleteTagAction);

  async function add(event: FormEvent) {
    event.preventDefault();
    if ((await create.run({ name })) !== undefined) setName("");
  }

  return (
    <div className="grid gap-6">
      {tags.length === 0 ? (
        <EmptyState title={t("settings.tags.empty")} />
      ) : (
        <ul className="divide-y rounded-lg border">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center gap-2 p-2 pl-4">
              <div className="flex-1">
                <p className="font-medium">{tag.name}</p>
                <p className="text-muted-foreground text-sm">
                  {t("settings.tags.usage", { count: tag.usage })}
                </p>
              </div>
              <RenameTag tag={tag} />
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${tag.name}: ${t("common.delete")}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                description={t("settings.tags.deleteConfirm", { name: tag.name })}
                confirmLabel={t("common.delete")}
                onConfirm={async () => {
                  await remove.run({ id: tag.id });
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-2">
        <FormField
          label={t("settings.tags.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="h-11 min-w-56"
          error={firstFieldError(t, create.fieldErrors, "name")}
        />
        <Button type="submit" className="h-11" disabled={create.pending}>
          <Plus aria-hidden />
          {t("settings.tags.add")}
        </Button>
      </form>
    </div>
  );
}

function RenameTag({ tag }: { tag: Tag }) {
  const t = useTranslations();
  const [name, setName] = useState(tag.name);
  const update = useAction(updateTagAction);
  return (
    <FormDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`${tag.name}: ${t("common.edit")}`}
        >
          <Pencil aria-hidden />
        </Button>
      }
      title={t("common.edit")}
      pending={update.pending}
      onOpen={() => {
        setName(tag.name);
        update.clearErrors();
      }}
      onSubmit={async () => (await update.run({ id: tag.id, name })) !== undefined}
    >
      <FormField
        label={t("settings.tags.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus
        error={firstFieldError(t, update.fieldErrors, "name")}
      />
    </FormDialog>
  );
}
