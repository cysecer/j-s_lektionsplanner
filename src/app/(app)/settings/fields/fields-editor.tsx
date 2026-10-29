"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { MoveButtons, moveItem } from "@/components/move-buttons";
import { EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomFieldType } from "@/generated/prisma/enums";
import { firstFieldError } from "@/lib/i18n-keys";
import { FILTERABLE_TYPES, SEARCHABLE_TYPES } from "@/lib/settings/schemas";
import { useAction } from "@/lib/use-action";
import { useSyncedState } from "@/lib/use-synced-state";
import {
  createCustomFieldAction,
  deleteCustomFieldAction,
  reorderCustomFieldsAction,
  restoreCustomFieldAction,
  updateCustomFieldAction,
} from "./actions";

type Field = {
  id: string;
  label: string;
  type: CustomFieldType;
  searchable: boolean;
  filterable: boolean;
  archived: boolean;
};

const TYPES = Object.values(CustomFieldType);

export function FieldsEditor({ active, archived }: { active: Field[]; archived: Field[] }) {
  const t = useTranslations();
  const [order, setOrder] = useSyncedState(active);
  const reorder = useAction(reorderCustomFieldsAction);
  const remove = useAction(deleteCustomFieldAction);
  const restore = useAction(restoreCustomFieldAction);

  return (
    <div className="grid gap-6">
      {order.length === 0 ? (
        <EmptyState title={t("settings.fields.empty")} />
      ) : (
        <ul className="divide-y rounded-lg border">
          {order.map((field, index) => (
            <li key={field.id} className="flex flex-wrap items-center gap-2 p-2 pl-4">
              <div className="grid min-w-40 flex-1 gap-1">
                <p className="font-medium">{field.label}</p>
                <p className="flex flex-wrap gap-1">
                  <Badge variant="outline">{t(`settings.fields.types.${field.type}`)}</Badge>
                  {field.searchable ? (
                    <Badge variant="secondary">{t("settings.fields.searchable")}</Badge>
                  ) : null}
                  {field.filterable ? (
                    <Badge variant="secondary">{t("settings.fields.filterable")}</Badge>
                  ) : null}
                </p>
              </div>
              <MoveButtons
                index={index}
                count={order.length}
                label={field.label}
                disabled={reorder.pending}
                onMove={(from, to) => {
                  const next = moveItem(order, from, to);
                  setOrder(next);
                  void reorder.run({ ids: next.map((f) => f.id) });
                }}
              />
              <FieldDialog
                mode="edit"
                field={field}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${field.label}: ${t("common.edit")}`}
                  >
                    <Pencil aria-hidden />
                  </Button>
                }
              />
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${field.label}: ${t("common.delete")}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                description={t("settings.fields.deleteConfirm", { name: field.label })}
                confirmLabel={t("common.delete")}
                onConfirm={async () => {
                  const result = await remove.run({ id: field.id });
                  if (result) {
                    toast.success(
                      t(result.archived ? "settings.fields.archived" : "settings.fields.deleted", {
                        name: field.label,
                      }),
                    );
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <FieldDialog
        mode="create"
        field={{
          id: "",
          label: "",
          type: "SHORT_TEXT",
          searchable: true,
          filterable: false,
          archived: false,
        }}
        trigger={
          <Button className="h-11 justify-self-start">
            <Plus aria-hidden />
            {t("settings.fields.add")}
          </Button>
        }
      />

      {archived.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-muted-foreground text-sm font-medium">
            {t("settings.fields.archivedTitle")}
          </h3>
          <ul className="divide-y rounded-lg border border-dashed">
            {archived.map((field) => (
              <li key={field.id} className="flex items-center justify-between gap-2 p-2 pl-4">
                <span className="text-muted-foreground">{field.label}</span>
                <Button
                  variant="ghost"
                  className="h-11"
                  disabled={restore.pending}
                  onClick={() => restore.run({ id: field.id })}
                >
                  <RotateCcw aria-hidden />
                  {t("common.restore")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FieldDialog({
  mode,
  field,
  trigger,
}: {
  mode: "create" | "edit";
  field: Field;
  trigger: ReactNode;
}) {
  const t = useTranslations();
  const typeLabelId = useId();
  const [values, setValues] = useState(field);
  const create = useAction(createCustomFieldAction);
  const update = useAction(updateCustomFieldAction);
  const action = mode === "create" ? create : update;
  const canSearch = SEARCHABLE_TYPES.includes(values.type);
  const canFilter = FILTERABLE_TYPES.includes(values.type);

  return (
    <FormDialog
      trigger={trigger}
      title={mode === "create" ? t("settings.fields.add") : t("settings.fields.editTitle")}
      pending={action.pending}
      onOpen={() => {
        setValues(field);
        action.clearErrors();
      }}
      onSubmit={async () => {
        const flags = {
          label: values.label,
          searchable: canSearch && values.searchable,
          filterable: canFilter && values.filterable,
        };
        const result =
          mode === "create"
            ? await create.run({ ...flags, type: values.type }, { success: t("common.saved") })
            : await update.run({ id: field.id, ...flags }, { success: t("common.saved") });
        return result !== undefined;
      }}
    >
      <FormField
        label={t("settings.fields.label")}
        value={values.label}
        onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
        maxLength={60}
        required
        autoFocus
        error={firstFieldError(t, action.fieldErrors, "label")}
      />
      <div className="grid gap-2">
        <Label id={typeLabelId}>{t("settings.fields.type")}</Label>
        <Select
          value={values.type}
          disabled={mode === "edit"}
          onValueChange={(type) => setValues((v) => ({ ...v, type: type as CustomFieldType }))}
        >
          <SelectTrigger size="lg" aria-labelledby={typeLabelId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`settings.fields.types.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mode === "edit" ? (
          <p className="text-muted-foreground text-sm">{t("settings.fields.typeLocked")}</p>
        ) : null}
      </div>
      {canSearch ? (
        <Label className="flex min-h-11 items-center gap-3 font-normal">
          <Checkbox
            checked={values.searchable}
            onCheckedChange={(v) => setValues((x) => ({ ...x, searchable: v === true }))}
          />
          {t("settings.fields.searchable")}
        </Label>
      ) : null}
      {canFilter ? (
        <Label className="flex min-h-11 items-center gap-3 font-normal">
          <Checkbox
            checked={values.filterable}
            onCheckedChange={(v) => setValues((x) => ({ ...x, filterable: v === true }))}
          />
          {t("settings.fields.filterable")}
        </Label>
      ) : null}
    </FormDialog>
  );
}
