import { z } from "zod";

export type ActionErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "rateLimited"
  | "internal";

/**
 * A translation key ("validation.email", "password.common", …), optionally
 * with the values its message needs (e.g. the allowed maximum).
 */
export type FieldError = string | { key: string; values: Record<string, number> };
export type FieldErrors = Record<string, FieldError[]>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorKind; code?: string; fieldErrors?: FieldErrors };

/** Throw inside a handler to return a typed failure instead of "internal". */
export class ActionFailure extends Error {
  constructor(
    readonly kind: ActionErrorKind,
    readonly code?: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(code ?? kind);
  }
}

const TRANSLATABLE = /^(validation|password)\.[A-Za-z]+$/;

export function fieldErrorKey(error: FieldError) {
  return typeof error === "string" ? error : error.key;
}

function sizeError(issue: z.core.$ZodIssue): FieldError | null {
  if (issue.code === "too_big") {
    const max = Number(issue.maximum);
    return issue.origin === "number" || issue.origin === "int"
      ? { key: "validation.numberMax", values: { max } }
      : { key: "validation.tooLongMax", values: { max } };
  }
  if (issue.code === "too_small") {
    const min = Number(issue.minimum);
    if (issue.origin === "number" || issue.origin === "int") {
      return { key: "validation.numberMin", values: { min } };
    }
    // "at least one character / entry" simply means: please fill in.
    return min <= 1 ? "validation.required" : { key: "validation.tooShortMin", values: { min } };
  }
  return null;
}

/**
 * A union (e.g. "empty or a number") fails as a single generic issue. Use
 * the branch that matched the input's type instead, so "999" reports
 * "at most 500" rather than "invalid".
 */
function flattenUnions(issues: z.core.$ZodIssue[]): z.core.$ZodIssue[] {
  return issues.flatMap((issue) => {
    if (issue.code !== "invalid_union" || !("errors" in issue) || issue.errors.length === 0) {
      return [issue];
    }
    const typeMismatch = (i: z.core.$ZodIssue) =>
      i.path.length === 0 && (i.code === "invalid_type" || i.code === "invalid_value");
    const branch = issue.errors.find((b) => b.length > 0 && !b.some(typeMismatch));
    if (!branch) return [issue];
    return flattenUnions(branch.map((i) => ({ ...i, path: [...issue.path, ...i.path] })));
  });
}

/**
 * Maps zod issues to translation keys per field path. Size limits carry the
 * actual limit ("höchstens 500"), so messages can say what is wrong. Other
 * issues use our schemas' message keys; zod's built-in English messages
 * become generic keys and are never shown.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of flattenUnions(error.issues)) {
    const path = issue.path.join(".") || "_";
    const entry: FieldError =
      sizeError(issue) ??
      (TRANSLATABLE.test(issue.message)
        ? issue.message
        : issue.code === "invalid_format" && issue.format === "email"
          ? "validation.email"
          : // zod omits issue.input by default; its message names the received type.
            issue.code === "invalid_type" && issue.message.endsWith("received undefined")
            ? "validation.required"
            : "validation.invalid");
    const list = (result[path] ??= []);
    if (!list.some((e) => fieldErrorKey(e) === fieldErrorKey(entry))) list.push(entry);
  }
  return result;
}
