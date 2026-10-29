import type { useTranslations } from "next-intl";
import type { ActionErrorKind, FieldError, FieldErrors } from "@/lib/server/result";

type T = ReturnType<typeof useTranslations<never>>;
type Values = Record<string, string | number>;

const KEY = /^(validation|password)\.[A-Za-z]+$/;

/**
 * Translates a message key coming from the server (zod field errors).
 * Unknown or malformed keys fall back to a generic message, so nothing the
 * server sends is ever shown verbatim.
 */
export function translateKey(t: T, key: string, values?: Values) {
  if (KEY.test(key) && t.has(key as never)) {
    try {
      return t(key as never, values as never);
    } catch {
      // A message that needs a value we don't have: fall back below.
    }
  }
  return t("validation.invalid");
}

/** Translates one field error; numeric values from the server fill the message. */
export function translateFieldError(t: T, error: FieldError, extra?: Values) {
  if (typeof error === "string") return translateKey(t, error, extra);
  const values = Object.fromEntries(
    Object.entries(error.values).filter(([, v]) => typeof v === "number" && Number.isFinite(v)),
  );
  return translateKey(t, error.key, { ...extra, ...values });
}

/** The error paths that belong to a field (the field itself or nested paths). */
function pathsFor(fieldErrors: FieldErrors | undefined, field: string) {
  return Object.keys(fieldErrors ?? {}).filter((p) => p === field || p.startsWith(`${field}.`));
}

export function firstFieldError(
  t: T,
  fieldErrors: FieldErrors | undefined,
  field: string,
  values?: Values,
) {
  // Nested paths (e.g. "description.content.0") belong to their top field.
  const path = fieldErrors?.[field] ? field : pathsFor(fieldErrors, field)[0];
  const error = path ? fieldErrors?.[path]?.[0] : undefined;
  return error ? translateFieldError(t, error, values) : undefined;
}

/**
 * One line per invalid field ("Max. Anzahl Kinder: Bitte höchstens 500
 * eingeben."), using the form's labels. Paths are matched to the longest
 * labelled prefix, e.g. "variations.2" → "Variationen".
 */
export function describeFieldErrors(
  t: T,
  fieldErrors: FieldErrors | undefined,
  labels: Record<string, string> = {},
  limit = 3,
) {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const [path, errors] of Object.entries(fieldErrors ?? {})) {
    const first = errors[0];
    if (!first) continue;
    const segments = path.split(".");
    let label: string | undefined;
    for (let i = segments.length; i > 0 && !label; i--)
      label = labels[segments.slice(0, i).join(".")];
    const line = `${label ? `${label}: ` : ""}${translateFieldError(t, first)}`;
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  return lines.length > limit ? [...lines.slice(0, limit), "…"] : lines;
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
