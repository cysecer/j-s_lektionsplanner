"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { actionErrorMessage, describeFieldErrors } from "@/lib/i18n-keys";
import type { ActionResult, FieldErrors } from "@/lib/server/result";

/** Moves keyboard focus (and the view) to the first field marked invalid. */
function focusFirstInvalid() {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!field) return;
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    field.focus({ preventScroll: true });
  });
}

/**
 * Runs a server action from a client component: tracks pending state and
 * field errors, refreshes the page on success and always reports failures.
 * For validation errors the toast names each invalid field (via `labels`)
 * with what is wrong, and focus jumps to the first invalid input.
 * Returns the data on success, undefined otherwise.
 */
export function useAction<I, O>(fn: (input: I) => Promise<ActionResult<O>>) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>();
  // Focus moves only after the errors are rendered: inside a transition the
  // aria-invalid markers can reach the DOM later than the next frame.
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest > 0) focusFirstInvalid();
  }, [focusRequest]);

  const run = useCallback(
    (input: I, options?: { success?: string; labels?: Record<string, string> }) =>
      new Promise<O | undefined>((resolve) => {
        startTransition(async () => {
          const result = await fn(input);
          if (result.ok) {
            setFieldErrors(undefined);
            if (options?.success) toast.success(options.success);
            router.refresh();
            resolve(result.data);
            return;
          }
          setFieldErrors(result.fieldErrors);
          const details = describeFieldErrors(t, result.fieldErrors, options?.labels);
          toast.error(actionErrorMessage(t, result), {
            description: details.length ? details.join("\n") : undefined,
            classNames: { description: "whitespace-pre-line" },
          });
          if (result.fieldErrors) setFocusRequest((n) => n + 1);
          resolve(undefined);
        });
      }),
    [fn, router, t],
  );

  return { run, pending, fieldErrors, clearErrors: () => setFieldErrors(undefined) };
}
