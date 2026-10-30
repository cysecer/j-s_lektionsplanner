"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/heic,image/heif,.heic,.heif";

const uploadResponse = z.object({ id: z.uuid(), width: z.int(), height: z.int() });
const errorResponse = z.object({ error: z.string(), code: z.string().optional() });

export type UploadedImage = z.infer<typeof uploadResponse>;

/**
 * Image picker with drag & drop and paste (Ctrl+V). The server checks the
 * real file type and size again; the checks here only give quick feedback.
 */
export function ImageUpload({
  purpose,
  onUploaded,
  className,
}: {
  purpose: "logo" | "favicon" | "sketch" | "field";
  onUploaded: (image: UploadedImage) => void;
  className?: string;
}) {
  const t = useTranslations();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  async function upload(file: File | undefined | null) {
    if (!file) return;
    setError(undefined);
    if (file.size > MAX_BYTES) return setError(t("errorCodes.tooLarge"));
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/uploads?purpose=${purpose}`, { method: "POST", body });
      const json: unknown = await response.json().catch(() => null);
      const ok = uploadResponse.safeParse(json);
      if (response.ok && ok.success) {
        onUploaded(ok.data);
        return;
      }
      const failure = errorResponse.safeParse(json);
      const code = failure.success ? failure.data.code : undefined;
      setError(
        code && ["tooLarge", "unsupportedType", "unreadable"].includes(code)
          ? t(`errorCodes.${code as "tooLarge" | "unsupportedType" | "unreadable"}`)
          : t("errors.internal"),
      );
    } catch {
      setError(t("errors.internal"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files[0]);
  }

  function onPaste(event: ClipboardEvent) {
    const file = [...event.clipboardData.files][0];
    if (file) {
      event.preventDefault();
      void upload(file);
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <label
        htmlFor={inputId}
        tabIndex={-1}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
          "focus-within:ring-ring/50 hover:bg-accent focus-within:ring-3",
          dragging && "border-primary bg-primary/5",
        )}
      >
        {busy ? (
          <Loader2 aria-hidden className="size-6 animate-spin" />
        ) : (
          <ImagePlus aria-hidden className="text-muted-foreground size-6" />
        )}
        <span className="font-medium">{busy ? t("upload.uploading") : t("upload.choose")}</span>
        <span className="text-muted-foreground text-sm">{t("upload.hint")}</span>
        <span className="text-muted-foreground text-xs">{t("upload.formats")}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => void upload(e.target.files?.[0])}
          onPaste={onPaste}
        />
      </label>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
