import type { useTranslations } from "next-intl";
import type { ActionErrorKind, FieldErrors } from "@/lib/server/result";

type T = ReturnType<typeof useTranslations<never>>;

const KEY = /^(validation|password)\.[A-Za-z]+$/;

/**
 * Translates a message key coming from the server (zod field errors).
 * Unknown or malformed keys fall back to a generic message, so nothing the
 * server sends is ever shown verbatim.
 */
export function translateKey(t: T, key: string, values?: Record<string, string | number>) {
  if (KEY.test(key) && t.has(key as never)) return t(key as never, values as never);
  return t("validation.invalid");
}

export function firstFieldError(
  t: T,
  fieldErrors: FieldErrors | undefined,
  field: string,
  values?: Record<string, string | number>,
) {
  // Nested paths (e.g. "description.content.0") belong to their top field.
  const path = fieldErrors?.[field]
    ? field
    : Object.keys(fieldErrors ?? {}).find((p) => p.startsWith(`${field}.`));
  const key = path ? fieldErrors?.[path]?.[0] : undefined;
  return key ? translateKey(t, key, values) : undefined;
}

export function errorMessage(t: T, error: ActionErrorKind) {
  return t(`errors.${error}`);
}

/** Specific message for a failure code (e.g. "lastAdmin") if one exists, else the generic one. */
export function actionErrorMessage(t: T, failure: { error: ActionErrorKind; code?: string }) {
  if (
    failure.code &&
    /^[A-Za-z]+$/.test(failure.code) &&
    t.has(`errorCodes.${failure.code}` as never)
  ) {
    return t(`errorCodes.${failure.code}` as never);
  }
  return errorMessage(t, failure.error);
}
