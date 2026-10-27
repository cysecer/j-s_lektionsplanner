import { z } from "zod";

export type ActionErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "rateLimited"
  | "internal";

/** Field errors carry translation keys ("validation.email", "password.common", …). */
export type FieldErrors = Record<string, string[]>;

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

/**
 * Maps zod issues to translation keys per field path. Our schemas use
 * keys as messages; zod's built-in English messages become generic keys.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    const key = TRANSLATABLE.test(issue.message)
      ? issue.message
      : issue.code === "invalid_format" && issue.format === "email"
        ? "validation.email"
        : issue.code === "too_big"
          ? "validation.tooLong"
          : issue.code === "too_small" ||
              // zod omits issue.input by default; its message names the received type.
              (issue.code === "invalid_type" && issue.message.endsWith("received undefined"))
            ? "validation.required"
            : "validation.invalid";
    const keys = (result[path] ??= []);
    if (!keys.includes(key)) keys.push(key);
  }
  return result;
}
