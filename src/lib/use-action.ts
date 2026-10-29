"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { actionErrorMessage } from "@/lib/i18n-keys";
import type { ActionResult, FieldErrors } from "@/lib/server/result";

/**
 * Runs a server action from a client component: tracks pending state and
 * field errors, shows a toast for other failures and refreshes the page on
 * success. Returns the data on success, undefined otherwise.
 */
export function useAction<I, O>(fn: (input: I) => Promise<ActionResult<O>>) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>();

  const run = useCallback(
    (input: I, options?: { success?: string }) =>
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
          // Always say that saving failed: field errors are additionally shown next
          // to the inputs, but a form may not display every field the server checks.
          toast.error(actionErrorMessage(t, result));
          resolve(undefined);
        });
      }),
    [fn, router, t],
  );

  return { run, pending, fieldErrors, clearErrors: () => setFieldErrors(undefined) };
}
