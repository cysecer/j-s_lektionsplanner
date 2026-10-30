"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleCheckBig,
  Eye,
  Loader2,
  Plus,
  Save,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { withoutPrefix } from "@/components/blocks/content-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LessonMailDialog } from "@/components/lesson-mail-dialog";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { actionErrorMessage, describeFieldErrors } from "@/lib/i18n-keys";
import {
  clearNewLessonDraft,
  newLessonDraftSnapshot,
  parseNewLessonDraft,
  storeNewLessonDraft,
} from "@/lib/lessons/draft-recovery";
import { normalize, type EditorItem } from "@/lib/lessons/editor-model";
import type { LessonOptions } from "@/lib/lessons/queries";
import type { LessonGeneralValues } from "@/lib/lessons/schema";
import type { LessonStatus } from "@/generated/prisma/enums";
import type { FieldErrors } from "@/lib/server/result";
import { createLessonAction, saveLessonAction } from "../actions";
import { GeneralForm } from "./general-form";
import { LeaveDialog, useLeaveGuard } from "./leave-guard";
import { LessonActions } from "./lesson-actions";
import { LessonDnd } from "./lesson-dnd";
import { LibraryPanel } from "./library-panel";
import { SectionBoard } from "./section-board";

type SaveState = "saved" | "dirty" | "saving" | "invalid" | "error" | "conflict";

const AUTOSAVE_DELAY_MS = 1500;

export function LessonEditor({
  lessonId,
  initialVersion,
  initialGeneral,
  initialItems,
  options,
  creator,
}: {
  /** null: a new lesson, stored only once "Entwurf speichern" is clicked. */
  lessonId: string | null;
  initialVersion: string;
  initialGeneral: LessonGeneralValues;
  initialItems: EditorItem[];
  options: LessonOptions;
  /** Who created the lesson (null for lessons from before this was recorded). */
  creator: { name: string | null; createdAt: string };
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const sectionOrder = useMemo(() => options.sections.map((s) => s.id), [options.sections]);
  const [general, setGeneral] = useState(initialGeneral);
  const [items, setItems] = useState(() => normalize(initialItems, sectionOrder));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>();
  // In teams with private drafts, finishing a lesson is what makes it visible.
  const privateDrafts = options.teams.find((x) => x.id === general.teamId)?.privateDrafts ?? false;

  // Refs so the save routine always sees the latest values without re-creating timers.
  const version = useRef(initialVersion);
  const latest = useRef({ general, items });
  useEffect(() => {
    latest.current = { general, items };
  }, [general, items]);
  const changes = useRef(0);
  const inFlight = useRef(false);

  const markDirty = () => {
    changes.current += 1;
    setSaveState((s) => (s === "conflict" ? s : "dirty"));
  };
  const updateGeneral = (patch: Partial<LessonGeneralValues>) => {
    setGeneral((g) => ({ ...g, ...patch }));
    markDirty();
  };
  const updateItems = useCallback(
    (next: (items: EditorItem[]) => EditorItem[]) => {
      setItems((current) => normalize(next(current), sectionOrder));
      changes.current += 1;
      setSaveState((s) => (s === "conflict" ? s : "dirty"));
    },
    [sectionOrder],
  );

  const save = useCallback(
    async (manual = false): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      const startedAt = changes.current;
      setSaveState("saving");
      const { general: lesson, items: currentItems } = latest.current;
      if (lessonId === null) {
        // First save of a new lesson: create it, then continue at its own address.
        const created = await createLessonAction({ lesson, items: currentItems });
        inFlight.current = false;
        if (created.ok) {
          clearNewLessonDraft();
          setFieldErrors(undefined);
          setSaveState("saved");
          toast.success(t("lessons.draftSaved"));
          router.replace(`/lessons/${created.data.id}`);
          return true;
        }
        setFieldErrors(created.fieldErrors);
        setSaveState(created.error === "validation" ? "invalid" : "error");
        toast.error(actionErrorMessage(t, created));
        return false;
      }
      const result = await saveLessonAction({
        id: lessonId,
        baseVersion: version.current,
        lesson,
        items: currentItems,
      });
      inFlight.current = false;

      if (result.ok) {
        version.current = result.data.version;
        setFieldErrors(undefined);
        // Changes made while saving are saved by the next round.
        setSaveState(changes.current === startedAt ? "saved" : "dirty");
        if (manual) toast.success(t("lessons.save.saved"));
        return true;
      }
      if (result.error === "conflict" && result.code === "lessonChanged") {
        setSaveState("conflict");
        return false;
      }
      setFieldErrors(result.fieldErrors);
      setSaveState(result.error === "validation" ? "invalid" : "error");
      if (manual) toast.error(actionErrorMessage(t, result));
      return false;
    },
    [lessonId, router, t],
  );

  /** Finish or reopen the lesson; saved right away together with any pending changes. */
  async function changeStatus(status: LessonStatus) {
    const previous = latest.current.general.status;
    const next = { ...latest.current.general, status };
    latest.current = { ...latest.current, general: next };
    setGeneral(next);
    markDirty();
    if (await save()) {
      toast.success(
        status === "FINAL"
          ? t(privateDrafts ? "lessons.published" : "lessons.finished")
          : t(privateDrafts ? "lessons.unpublished" : "lessons.reopened"),
      );
      return;
    }
    // Not saved: keep editing as before, the error summary says what is missing.
    latest.current = {
      ...latest.current,
      general: { ...latest.current.general, status: previous },
    };
    setGeneral((g) => ({ ...g, status: previous }));
    toast.error(t("lessons.statusNotChanged"));
  }

  /** Pending changes are saved first, so preview and PDF show the current state. */
  async function savedFirst() {
    if (saveState !== "saved" && !(await save())) {
      toast.error(t("lessons.preview.saveFirst"));
      return false;
    }
    return true;
  }

  async function openPreview() {
    if (lessonId && (await savedFirst())) router.push(`/lessons/${lessonId}/preview`);
  }

  // Autosave shortly after the last change – drafts and finished lessons,
  // once the lesson is stored.
  useEffect(() => {
    if (lessonId === null || saveState !== "dirty") return;
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [lessonId, general, items, saveState, save]);

  // Leaving in any way (link, back button, closing or hiding the tab):
  // changes still waiting for the autosave are saved right away.
  const saveRef = useRef(save);
  const pendingRef = useRef(false);
  useEffect(() => {
    saveRef.current = save;
    pendingRef.current = saveState === "dirty";
  }, [save, saveState]);
  useEffect(() => {
    if (lessonId === null) return;
    const flush = () => {
      if (pendingRef.current) void saveRef.current();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      flush(); // the editor closes: in-app navigation
    };
  }, [lessonId]);

  // Ask before leaving when changes cannot be saved automatically: a new
  // lesson not stored yet, or a stored one whose saving failed.
  const leave = useLeaveGuard(
    lessonId === null
      ? saveState !== "saved"
      : saveState === "invalid" || saveState === "error" || saveState === "conflict",
  );

  // New lessons: a copy in the browser survives reloads, crashes and the
  // back button; it is offered again when a new lesson is opened.
  const recoverySnapshot = useSyncExternalStore(
    () => () => {},
    () => (lessonId === null ? newLessonDraftSnapshot() : null),
    () => null,
  );
  const [recoveryHandled, setRecoveryHandled] = useState(false);
  // Offered until the person restores, discards or starts typing anew.
  const recovered =
    recoveryHandled || saveState !== "saved" ? null : parseNewLessonDraft(recoverySnapshot);
  useEffect(() => {
    if (lessonId !== null || saveState !== "dirty") return;
    const timer = setTimeout(() => storeNewLessonDraft({ general, items }), 400);
    return () => clearTimeout(timer);
  }, [lessonId, general, items, saveState]);

  function restoreDraft() {
    if (!recovered) return;
    setGeneral(recovered.general);
    setItems(normalize(recovered.items, sectionOrder));
    markDirty();
    setRecoveryHandled(true);
  }

  const generalErrors = withoutPrefix(fieldErrors, "lesson.");
  const itemErrorIds = new Set(
    Object.keys(fieldErrors ?? {})
      .map((path) => /^items\.(\d+)\./.exec(path)?.[1])
      .filter((x): x is string => x !== undefined)
      .map((index) => items[Number(index)]?.id)
      .filter((x): x is string => Boolean(x)),
  );
  const errorSummary = describeFieldErrors(t, generalErrors, {
    title: t("lessons.general.title"),
    authorName: t("lessons.general.author"),
    date: t("lessons.general.date"),
    totalDurationMinutes: t("lessons.general.totalDuration"),
    startTime: t("lessons.general.startTime"),
    ageMin: t("lessons.general.ageMin"),
    ageMax: t("lessons.general.ageMax"),
    location: t("lessons.general.location"),
    groupSize: t("lessons.general.groupSize"),
  });

  const library = (draggable: boolean) => (
    <LibraryPanel
      options={options}
      lessonTeamId={general.teamId}
      draggable={draggable}
      onAdd={(item) => updateItems((current) => [...current, item])}
    />
  );

  return (
    <div data-wide-page className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="-ml-3 h-11">
          <Link href="/lessons">
            <ArrowLeft aria-hidden />
            {t("lessons.back")}
          </Link>
        </Button>
        {lessonId === null ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground text-sm" role="status">
              {t("lessons.notSavedYet")}
            </p>
            <Button
              className="h-11"
              disabled={saveState === "saving"}
              onClick={() => void save(true)}
            >
              {saveState === "saving" ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <Save aria-hidden />
              )}
              {t("lessons.saveDraft")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <SaveIndicator state={saveState} />
            {/* Autosave runs on its own; after a failure, retry by hand. */}
            {saveState === "invalid" || saveState === "error" ? (
              <Button className="h-11" onClick={() => void save(true)}>
                {t("lessons.save.saveNow")}
              </Button>
            ) : null}
            {general.status === "DRAFT" ? (
              <Button
                className="h-11"
                disabled={saveState === "saving" || saveState === "conflict"}
                onClick={() => void changeStatus("FINAL")}
              >
                <CircleCheckBig aria-hidden />
                {privateDrafts ? t("lessons.publish") : t("lessons.finish")}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-11"
                disabled={saveState === "saving" || saveState === "conflict"}
                onClick={() => void changeStatus("DRAFT")}
              >
                <Undo2 aria-hidden />
                {t("lessons.reopen")}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11"
              disabled={saveState === "saving" || saveState === "conflict"}
              onClick={() => void openPreview()}
            >
              <Eye aria-hidden />
              {t("lessons.preview.open")}
            </Button>
            <PdfDownloadButton lessonId={lessonId} remaining={null} beforeDownload={savedFirst} />
            <LessonMailDialog lessonId={lessonId} beforeOpen={savedFirst} />
            <LessonActions lessonId={lessonId} title={general.title} />
          </div>
        )}
      </div>

      {recovered ? (
        <Alert role="status">
          <AlertTitle>{t("lessons.recovery.title")}</AlertTitle>
          <AlertDescription className="grid gap-2">
            <p>
              {t("lessons.recovery.body", {
                title: recovered.general.title || t("lessons.untitled"),
                time: format.dateTime(new Date(recovered.savedAt), {
                  dateStyle: "short",
                  timeStyle: "short",
                }),
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button className="h-11" onClick={restoreDraft}>
                {t("lessons.recovery.restore")}
              </Button>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => {
                  clearNewLessonDraft();
                  setRecoveryHandled(true);
                }}
              >
                {t("lessons.recovery.discard")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <LeaveDialog
        open={leave.target !== null}
        title={lessonId === null ? t("lessons.leave.newTitle") : t("lessons.leave.failedTitle")}
        description={lessonId === null ? t("lessons.leave.newBody") : t("lessons.leave.failedBody")}
        onCancel={leave.cancel}
      >
        <Button variant="outline" className="h-11" onClick={leave.cancel}>
          {t("lessons.leave.stay")}
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            if (lessonId === null) clearNewLessonDraft();
            leave.leave();
          }}
        >
          {t("lessons.leave.discard")}
        </Button>
        {lessonId === null ? (
          <Button
            className="h-11"
            onClick={async () => {
              leave.cancel();
              await save(true);
            }}
          >
            {t("lessons.saveDraft")}
          </Button>
        ) : null}
      </LeaveDialog>

      {saveState === "conflict" ? (
        <Alert variant="destructive" role="alert">
          <AlertTriangle aria-hidden />
          <AlertTitle>{t("lessons.save.conflictTitle")}</AlertTitle>
          <AlertDescription className="grid gap-2">
            <p>{t("lessons.save.conflictBody")}</p>
            <Button
              variant="outline"
              className="h-11 justify-self-start"
              onClick={() => window.location.reload()}
            >
              {t("lessons.save.reload")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {saveState === "invalid" && errorSummary.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>{t("lessons.save.failed")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {errorSummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <LessonDnd items={items} sectionOrder={sectionOrder} updateItems={updateItems}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
          <div className="grid min-w-0 gap-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {general.title || t("lessons.untitled")}
              </h1>
              <Badge variant={general.status === "FINAL" ? "default" : "secondary"}>
                {t(`lessons.status.${general.status}`)}
              </Badge>
            </div>

            <GeneralForm
              values={general}
              onChange={updateGeneral}
              options={options}
              fieldErrors={generalErrors}
              creator={creator}
              privateDraft={privateDrafts && general.status === "DRAFT"}
            />

            <SectionBoard
              items={items}
              options={options}
              general={general}
              itemErrorIds={itemErrorIds}
              updateItems={updateItems}
            />
          </div>
          <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border p-4 lg:block">
            <h2 className="mb-3 text-lg font-semibold">{t("lessons.library.title")}</h2>
            {library(true)}
          </aside>
        </div>
      </LessonDnd>

      <div className="fixed right-4 bottom-4 z-30 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="lg" className="h-12 shadow-lg">
              <Plus aria-hidden />
              {t("lessons.library.open")}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{t("lessons.library.title")}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">{library(false)}</div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("lessons.save");
  const content: Record<SaveState, [React.ReactNode, string]> = {
    saved: [<Check key="i" aria-hidden className="size-4" />, t("saved")],
    dirty: [null, t("unsaved")],
    saving: [<Loader2 key="i" aria-hidden className="size-4 animate-spin" />, t("saving")],
    invalid: [<AlertTriangle key="i" aria-hidden className="size-4" />, t("failed")],
    error: [<AlertTriangle key="i" aria-hidden className="size-4" />, t("offline")],
    conflict: [<AlertTriangle key="i" aria-hidden className="size-4" />, t("conflictTitle")],
  };
  const [icon, text] = content[state];
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        state === "invalid" || state === "error" || state === "conflict"
          ? "text-destructive flex items-center gap-1 text-sm"
          : "text-muted-foreground flex items-center gap-1 text-sm"
      }
    >
      {icon}
      {text}
    </p>
  );
}
