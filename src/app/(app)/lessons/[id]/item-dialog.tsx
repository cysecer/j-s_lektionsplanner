"use client";

import { Library } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  ContentFields,
  CustomFieldInputs,
  GroupSizeFields,
  withoutEmptyValues,
  type ContentSetter,
} from "@/components/blocks/content-fields";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BLOCK_LIMITS } from "@/lib/blocks/schema";
import { actionErrorMessage, describeFieldErrors, firstFieldError } from "@/lib/i18n-keys";
import type { EditorItem } from "@/lib/lessons/editor-model";
import type { LessonOptions } from "@/lib/lessons/queries";
import { lessonItemSchema } from "@/lib/lessons/schema";
import { toFieldErrors, type FieldErrors } from "@/lib/server/result";
import { createBlockFromItemAction, overwriteBlockFromItemAction } from "../actions";
import { ResponsibleSelect } from "./responsible-select";

/** Content fields that make up the library block (not placement or responsible). */
const CONTENT_KEYS = [
  "title",
  "durationMinutes",
  "description",
  "rules",
  "variations",
  "organization",
  "material",
  "sketchAssetIds",
  "teamCount",
  "minParticipants",
  "maxParticipants",
  "customValues",
] as const;

const contentOf = (item: EditorItem) =>
  JSON.stringify(
    CONTENT_KEYS.map((k) => (k === "customValues" ? withoutEmptyValues(item[k]) : item[k])),
  );

export function ItemDialog({
  item,
  options,
  presentCoachIds,
  onClose,
  onSave,
}: {
  item: EditorItem;
  options: LessonOptions;
  presentCoachIds: string[];
  onClose: () => void;
  onSave: (item: EditorItem) => void;
}) {
  const t = useTranslations();
  const [values, setValues] = useState(item);
  const [errors, setErrors] = useState<FieldErrors>();
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const responsibleId = useId();
  const activeFields = options.fields.filter((f) => !f.archived);

  const set: ContentSetter = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const error = (path: string) => firstFieldError(t, errors, path);
  const labels = {
    title: t("blockFields.title"),
    durationMinutes: t("blockFields.duration"),
    teamCount: t("blocks.form.teamCount"),
    minParticipants: t("blocks.form.minParticipants"),
    maxParticipants: t("blocks.form.maxParticipants"),
    "responsible.text": t("lessons.itemDialog.responsibleText"),
    ...Object.fromEntries(activeFields.map((f) => [`customValues.${f.id}`, f.label])),
  };

  /** Validates locally with the same schema the server uses. */
  function cleaned(): EditorItem | null {
    const next: EditorItem = {
      ...values,
      variations: values.variations.map((x) => x.trim()).filter(Boolean),
      material: values.material.map((x) => x.trim()).filter(Boolean),
      customValues: withoutEmptyValues(values.customValues),
    };
    const parsed = lessonItemSchema.safeParse(next);
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);
      toast.error(t("errors.validation"), {
        description: describeFieldErrors(t, fieldErrors, labels).join("\n"),
        classNames: { description: "whitespace-pre-line" },
      });
      return null;
    }
    setErrors(undefined);
    return next;
  }

  function apply() {
    const next = cleaned();
    if (!next) return;
    // Only content changes concern the library; a new responsible person does not.
    if (next.sourceBlockId && contentOf(next) !== contentOf(item)) {
      setChoosing(true);
      return;
    }
    onSave(next);
    onClose();
  }

  async function run(kind: "local" | "overwrite" | "asNew" | "toLibrary") {
    const next = cleaned();
    if (!next) return;
    if (kind === "local") {
      onSave({ ...next, modifiedLocally: true });
      onClose();
      return;
    }
    setBusy(true);
    if (kind === "overwrite" && next.sourceBlockId) {
      const result = await overwriteBlockFromItemAction({
        blockId: next.sourceBlockId,
        item: next,
      });
      setBusy(false);
      if (!result.ok) return void toast.error(actionErrorMessage(t, result));
      toast.success(t("lessons.choice.overwritten"));
      onSave({ ...next, modifiedLocally: false });
    } else {
      const result = await createBlockFromItemAction({ item: next, sectionId: next.sectionId });
      setBusy(false);
      if (!result.ok) return void toast.error(actionErrorMessage(t, result));
      toast.success(
        kind === "asNew" ? t("lessons.choice.createdNew") : t("lessons.itemDialog.savedToLibrary"),
      );
      onSave({ ...next, sourceBlockId: result.data.id, modifiedLocally: false });
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {choosing ? (
          <ChoiceView
            name={item.title}
            busy={busy}
            onChoose={(kind) => void run(kind)}
            onCancel={() => setChoosing(false)}
          />
        ) : (
          <form
            noValidate
            className="grid gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("lessons.itemDialog.title")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
              <FormField
                label={t("blockFields.title")}
                value={values.title}
                maxLength={BLOCK_LIMITS.title}
                onChange={(e) => set("title", e.target.value)}
                error={error("title")}
              />
              <FormField
                label={`${t("blockFields.duration")} (${t("common.minutes")})`}
                type="number"
                inputMode="numeric"
                min={0}
                max={BLOCK_LIMITS.durationMax}
                value={String(values.durationMinutes ?? "")}
                onChange={(e) => set("durationMinutes", e.target.value)}
                error={error("durationMinutes")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={responsibleId}>{t("lessons.itemDialog.responsible")}</Label>
              <ResponsibleSelect
                id={responsibleId}
                value={values.responsible}
                onChange={(responsible) => setValues((x) => ({ ...x, responsible }))}
                coaches={options.coaches}
                presentCoachIds={presentCoachIds}
              />
              {values.responsible.kind === "text" ? (
                <FormField
                  label={t("lessons.itemDialog.responsibleText")}
                  value={values.responsible.text}
                  maxLength={100}
                  onChange={(e) =>
                    setValues((x) => ({
                      ...x,
                      responsible: { kind: "text", text: e.target.value },
                    }))
                  }
                  error={error("responsible.text")}
                />
              ) : null}
            </div>

            <GroupSizeFields values={values} set={set} error={error} />
            <ContentFields values={values} set={set} error={error} />

            {activeFields.length > 0 ? (
              <div className="grid gap-3">
                <h3 className="font-semibold">{t("lessons.itemDialog.customFields")}</h3>
                <CustomFieldInputs
                  fields={activeFields}
                  values={values.customValues}
                  onChange={(id, v) =>
                    setValues((x) => ({ ...x, customValues: { ...x.customValues, [id]: v } }))
                  }
                  error={error}
                />
              </div>
            ) : null}

            <DialogFooter className="flex-wrap gap-2">
              {!item.sourceBlockId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 sm:mr-auto"
                  disabled={busy}
                  onClick={() => void run("toLibrary")}
                >
                  <Library aria-hidden />
                  {t("lessons.itemDialog.saveToLibrary")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="h-11" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" className="h-11" disabled={busy}>
                {t("lessons.itemDialog.apply")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Nur für dieses Training" / "überschreiben" / "als neuen Block" / Abbrechen. */
function ChoiceView({
  name,
  busy,
  onChoose,
  onCancel,
}: {
  name: string;
  busy: boolean;
  onChoose: (kind: "local" | "overwrite" | "asNew") => void;
  onCancel: () => void;
}) {
  const t = useTranslations("lessons.choice");
  const tc = useTranslations("common");
  const choices = [
    { kind: "local", label: t("local"), hint: t("localHint") },
    { kind: "overwrite", label: t("overwrite"), hint: t("overwriteHint") },
    { kind: "asNew", label: t("asNew"), hint: t("asNewHint") },
  ] as const;
  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("body", { name })}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        {choices.map((c, i) => (
          <Button
            key={c.kind}
            variant={i === 0 ? "default" : "outline"}
            className="h-auto min-h-14 flex-col items-start gap-0.5 px-4 py-3 text-left whitespace-normal"
            disabled={busy}
            onClick={() => onChoose(c.kind)}
          >
            <span className="font-semibold">{c.label}</span>
            <span className="text-sm font-normal opacity-80">{c.hint}</span>
          </Button>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" className="h-11" onClick={onCancel} disabled={busy}>
          {tc("cancel")}
        </Button>
      </DialogFooter>
    </div>
  );
}
