"use client";

import { FileDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/i18n-keys";
import type { ActionErrorKind } from "@/lib/server/result";

const ERROR_KINDS = new Set<ActionErrorKind>([
  "validation",
  "unauthorized",
  "forbidden",
  "notFound",
  "conflict",
  "rateLimited",
  "internal",
]);

/** File name from Content-Disposition (UTF-8 form preferred). */
function fileNameOf(header: string | null): string {
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header ?? "")?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      // fall through to the ASCII name
    }
  }
  return /filename="([^"]+)"/i.exec(header ?? "")?.[1] ?? "Lektionsvorbereitung.pdf";
}

/**
 * Downloads the lesson as PDF. Errors (e.g. the reader's daily limit) show
 * as a message instead of a broken download. `remaining` is the reader's
 * quota left today; null for coaches.
 */
export function PdfDownloadButton({
  lessonId,
  layoutId,
  remaining,
  beforeDownload,
}: {
  lessonId: string;
  layoutId?: string | null;
  remaining: number | null;
  /** E.g. save pending changes first; false cancels. */
  beforeDownload?: () => Promise<boolean>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(remaining);

  async function download() {
    setBusy(true);
    try {
      if (beforeDownload && !(await beforeDownload())) return;
      const query = layoutId ? `?layout=${encodeURIComponent(layoutId)}` : "";
      const response = await fetch(`/api/lessons/${lessonId}/pdf${query}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        const error = ERROR_KINDS.has(body.error as ActionErrorKind)
          ? (body.error as ActionErrorKind)
          : "internal";
        toast.error(actionErrorMessage(t, { error, code: body.code }));
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameOf(response.headers.get("content-disposition"));
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (left !== null) setLeft(Math.max(0, left - 1));
      router.refresh();
    } catch {
      toast.error(t("errors.internal"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="h-11" disabled={busy || left === 0} onClick={() => void download()}>
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <FileDown aria-hidden />}
        {busy ? t("pdf.creating") : t("pdf.download")}
      </Button>
      {left !== null ? (
        <span className="text-muted-foreground text-sm" role="status">
          {t("pdf.remaining", { count: left })}
        </span>
      ) : null}
    </div>
  );
}
