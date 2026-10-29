"use client";

import { Loader2, Mail, Paperclip, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  lessonMailDialogAction,
  sendLessonMailAction,
} from "@/app/(app)/lessons/[id]/mail-actions";
import { actionErrorMessage, firstFieldError } from "@/lib/i18n-keys";
import { MAX_MESSAGE_LENGTH, MAX_RECIPIENTS, renderLessonEmail } from "@/lib/mail/lesson-email";
import { useAction } from "@/lib/use-action";

type DialogData = Extract<Awaited<ReturnType<typeof lessonMailDialogAction>>, { ok: true }>["data"];

const isEmail = (value: string) => z.email().max(254).safeParse(value).success;

/** "a@b.ch, c@d.ch; e@f.ch" → separate addresses. */
function splitAddresses(raw: string) {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().replace(/^<|>$/g, "").toLowerCase())
    .filter(Boolean);
}

/**
 * Sends the lesson as PDF by email: recipients with suggestions, subject,
 * a personal message, a preview of what arrives and the send history.
 */
export function LessonMailDialog({
  lessonId,
  layoutId = null,
  beforeOpen,
}: {
  lessonId: string;
  layoutId?: string | null;
  /** E.g. save pending changes first; false cancels. */
  beforeOpen?: () => Promise<boolean>;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const ids = { recipients: useId(), suggestions: useId(), message: useId() };
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DialogData | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string>();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const send = useAction(sendLessonMailAction);

  async function openDialog() {
    setLoading(true);
    try {
      if (beforeOpen && !(await beforeOpen())) return;
      const result = await lessonMailDialogAction({ lessonId });
      if (!result.ok) {
        toast.error(actionErrorMessage(t, result));
        return;
      }
      setData(result.data);
      setSubject(result.data.subject);
      setMessage(result.data.message);
      setTo([]);
      setDraft("");
      setDraftError(undefined);
      setShowPreview(false);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  /** Moves typed addresses into the list; returns the list including them. */
  function commitDraft(): string[] | null {
    const parts = splitAddresses(draft);
    if (parts.length === 0) return to;
    const invalid = parts.filter((p) => !isEmail(p));
    if (invalid.length > 0) {
      setDraftError(t("mail.dialog.invalidAddress", { address: invalid[0]! }));
      return null;
    }
    const next = [...new Set([...to, ...parts])];
    if (next.length > MAX_RECIPIENTS) {
      setDraftError(t("validation.tooManyRecipients"));
      return null;
    }
    setTo(next);
    setDraft("");
    setDraftError(undefined);
    return next;
  }

  function onDraftKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && to.length > 0) {
      setTo(to.slice(0, -1));
    }
  }

  async function submit() {
    const recipients = commitDraft();
    if (!recipients) return;
    const result = await send.run(
      { lessonId, layoutId, to: recipients, subject, message },
      {
        labels: {
          to: t("mail.dialog.to"),
          subject: t("mail.dialog.subject"),
          message: t("mail.dialog.message"),
        },
      },
    );
    if (result) {
      toast.success(t("mail.dialog.sent", { count: result.count }));
      setOpen(false);
    }
  }

  const recipientError = draftError ?? firstFieldError(t, send.fieldErrors, "to");
  const preview = data
    ? renderLessonEmail({ message, footer: data.footer, attachmentName: data.attachmentName })
    : null;
  const chosen = new Set(to);

  return (
    <>
      <Button
        variant="outline"
        className="h-11"
        disabled={loading}
        onClick={() => void openDialog()}
      >
        {loading ? <Loader2 aria-hidden className="animate-spin" /> : <Mail aria-hidden />}
        {t("mail.dialog.open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <form
            noValidate
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("mail.dialog.title")}</DialogTitle>
              <DialogDescription>{t("mail.dialog.description")}</DialogDescription>
            </DialogHeader>

            {data && !data.from ? (
              <Alert variant="destructive">
                <AlertDescription>{t("mail.dialog.notConfigured")}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor={ids.recipients}>{t("mail.dialog.to")}</Label>
              {to.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label={t("mail.dialog.recipientList")}>
                  {to.map((email) => (
                    <li
                      key={email}
                      className="bg-muted flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
                    >
                      {email}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 rounded-full"
                        aria-label={t("mail.dialog.removeRecipient", { email })}
                        onClick={() => setTo(to.filter((e) => e !== email))}
                      >
                        <X aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Input
                id={ids.recipients}
                inputMode="email"
                list={ids.suggestions}
                className="h-11 text-base"
                value={draft}
                placeholder={t("mail.dialog.toPlaceholder")}
                autoComplete="off"
                aria-invalid={recipientError ? true : undefined}
                aria-describedby={`${ids.recipients}-hint`}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftError(undefined);
                }}
                onKeyDown={onDraftKey}
                onBlur={() => {
                  if (draft.trim()) commitDraft();
                }}
              />
              <datalist id={ids.suggestions}>
                {data?.suggestions
                  .filter((s) => !chosen.has(s.email))
                  .map((s) => (
                    <option key={s.email} value={s.email}>
                      {s.name ?? undefined}
                    </option>
                  ))}
              </datalist>
              {recipientError ? (
                <p className="text-destructive text-sm" role="alert">
                  {recipientError}
                </p>
              ) : (
                <p id={`${ids.recipients}-hint`} className="text-muted-foreground text-sm">
                  {t("mail.dialog.toHint", { max: MAX_RECIPIENTS })}
                </p>
              )}
            </div>

            <FormField
              label={t("mail.dialog.subject")}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
              error={firstFieldError(t, send.fieldErrors, "subject")}
            />

            <div className="grid gap-2">
              <Label htmlFor={ids.message}>{t("mail.dialog.message")}</Label>
              <Textarea
                id={ids.message}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={7}
                className="text-base"
                aria-invalid={firstFieldError(t, send.fieldErrors, "message") ? true : undefined}
              />
              {firstFieldError(t, send.fieldErrors, "message") ? (
                <p className="text-destructive text-sm" role="alert">
                  {firstFieldError(t, send.fieldErrors, "message")}
                </p>
              ) : null}
            </div>

            {data ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Paperclip aria-hidden className="size-4 shrink-0" />
                <span className="break-all">{data.attachmentName}</span>
              </p>
            ) : null}

            <div>
              <Button
                type="button"
                variant="ghost"
                className="-ml-3 h-11"
                aria-expanded={showPreview}
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? t("mail.dialog.hidePreview") : t("mail.dialog.showPreview")}
              </Button>
              {showPreview && data && preview ? (
                <section
                  aria-label={t("mail.dialog.preview")}
                  className="bg-muted/40 mt-2 grid gap-3 rounded-lg border p-4 text-sm"
                >
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">{t("mail.dialog.from")}</dt>
                    <dd className="break-all">{data.from ?? "–"}</dd>
                    <dt className="text-muted-foreground">{t("mail.dialog.replyTo")}</dt>
                    <dd className="break-all">{data.replyTo}</dd>
                    <dt className="text-muted-foreground">{t("mail.dialog.to")}</dt>
                    <dd className="break-all">{to.join(", ") || "–"}</dd>
                    <dt className="text-muted-foreground">{t("mail.dialog.subject")}</dt>
                    <dd>{subject}</dd>
                  </dl>
                  <pre className="bg-background rounded-md border p-3 font-sans whitespace-pre-wrap">
                    {preview.text}
                  </pre>
                </section>
              ) : null}
            </div>

            {data && data.history.length > 0 ? (
              <section aria-label={t("mail.dialog.history")} className="grid gap-2 text-sm">
                <h3 className="font-medium">{t("mail.dialog.history")}</h3>
                <ul className="text-muted-foreground grid gap-1">
                  {data.history.map((h) => (
                    <li key={h.at}>
                      {t(h.failed ? "mail.dialog.historyFailed" : "mail.dialog.historyEntry", {
                        at: format.dateTime(new Date(h.at), {
                          dateStyle: "short",
                          timeStyle: "short",
                        }),
                        by: h.by,
                        recipients: h.recipients.join(", "),
                      })}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" className="h-11" disabled={send.pending || !data?.from}>
                {send.pending ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <Mail aria-hidden />
                )}
                {send.pending ? t("mail.dialog.sending") : t("mail.dialog.send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
