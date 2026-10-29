"use client";

import { Copy, Pencil, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { firstFieldError } from "@/lib/i18n-keys";
import { useAction } from "@/lib/use-action";
import {
  createLayoutAction,
  deleteLayoutAction,
  duplicateLayoutAction,
  setDefaultLayoutAction,
} from "./actions";

type Layout = { id: string; name: string; lessons: number; isDefault: boolean };

export function LayoutsList({ layouts }: { layouts: Layout[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const create = useAction(createLayoutAction);
  const duplicate = useAction(duplicateLayoutAction);
  const setDefault = useAction(setDefaultLayoutAction);
  const remove = useAction(deleteLayoutAction);

  async function add(event: FormEvent) {
    event.preventDefault();
    const created = await create.run({ name });
    if (created) router.push(`/settings/layout/${created.id}`);
  }

  return (
    <div className="grid gap-6">
      <ul className="divide-y rounded-lg border">
        {layouts.map((layout) => (
          <li key={layout.id} className="flex flex-wrap items-center gap-2 p-2 pl-4">
            <div className="min-w-48 flex-1">
              <p className="font-medium">
                {layout.name}
                {layout.isDefault ? (
                  <Badge className="ml-2 align-middle">{t("settings.layout.default")}</Badge>
                ) : null}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("settings.layout.usedBy", { count: layout.lessons })}
              </p>
            </div>
            <Button asChild variant="outline" className="h-11">
              <Link
                href={`/settings/layout/${layout.id}`}
                aria-label={`${layout.name}: ${t("common.edit")}`}
              >
                <Pencil aria-hidden />
                {t("common.edit")}
              </Link>
            </Button>
            {!layout.isDefault ? (
              <Button
                variant="ghost"
                className="h-11"
                aria-label={`${layout.name}: ${t("settings.layout.makeDefault")}`}
                disabled={setDefault.pending}
                onClick={() =>
                  void setDefault.run(
                    { id: layout.id },
                    { success: t("settings.layout.defaultSet", { name: layout.name }) },
                  )
                }
              >
                <Star aria-hidden />
                {t("settings.layout.makeDefault")}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              disabled={duplicate.pending}
              aria-label={`${layout.name}: ${t("settings.layout.duplicate")}`}
              onClick={async () => {
                const copy = await duplicate.run({
                  id: layout.id,
                  suffix: t("settings.layout.copySuffix"),
                });
                if (copy) router.push(`/settings/layout/${copy.id}`);
              }}
            >
              <Copy aria-hidden />
            </Button>
            {!layout.isDefault ? (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${layout.name}: ${t("common.delete")}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                description={t("settings.layout.deleteConfirm", {
                  name: layout.name,
                  count: layout.lessons,
                })}
                confirmLabel={t("common.delete")}
                onConfirm={async () => {
                  await remove.run({ id: layout.id });
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
          label={t("settings.layout.newName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="h-11 min-w-56"
          error={firstFieldError(t, create.fieldErrors, "name")}
        />
        <Button type="submit" className="h-11" disabled={create.pending}>
          <Plus aria-hidden />
          {t("settings.layout.add")}
        </Button>
      </form>
    </div>
  );
}
