import { z } from "zod";
import { SmtpSecurity } from "@/generated/prisma/enums";
import { displayName } from "@/lib/settings/schemas";

/**
 * Usual mail submission ports (465 TLS, 587 STARTTLS, 25 and 2525 for some
 * providers, 1025 for local test servers). Anything else is refused, so the
 * setting cannot be used to make the server probe other internal services.
 */
export const SMTP_PORTS = [25, 465, 587, 1025, 2525] as const;

const DNS_NAME =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

const hostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: "validation.required" })
  .max(253, { message: "validation.tooLong" })
  .refine(
    (v) => DNS_NAME.test(v) || z.ipv4().safeParse(v).success || z.ipv6().safeParse(v).success,
    { message: "validation.hostname" },
  );

/** No line breaks or other control characters (they would break SMTP commands). */
const noControl = (v: string) => !/[\p{Cc}]/u.test(v);

/**
 * The admin form. `password` is write-only: empty keeps the stored one,
 * `clearPassword` removes it. `allowInsecure` mirrors SMTP_REQUIRE_TLS=false.
 */
export function mailSettingsSchema(allowInsecure: boolean) {
  return z.strictObject({
    host: hostSchema,
    port: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.coerce
        .number({ message: "validation.smtpPort" })
        .int({ message: "validation.smtpPort" })
        .refine((p) => (SMTP_PORTS as readonly number[]).includes(p), {
          message: "validation.smtpPort",
        }),
    ),
    security: z
      .enum(SmtpSecurity)
      .refine((s) => allowInsecure || s !== "NONE", { message: "validation.smtpInsecure" }),
    username: z.union([
      z.literal("").transform(() => null),
      z
        .string()
        .trim()
        .min(1)
        .max(254, { message: "validation.tooLong" })
        .refine(noControl, { message: "validation.invalid" }),
    ]),
    password: z
      .string()
      .max(256, { message: "validation.tooLong" })
      .refine(noControl, { message: "validation.invalid" }),
    clearPassword: z.boolean(),
    fromEmail: z
      .email({ message: "validation.email" })
      .max(254)
      .transform((e) => e.toLowerCase()),
    fromName: z.union([z.literal("").transform(() => null), displayName(80)]),
  });
}

export type MailSettingsInput = z.output<ReturnType<typeof mailSettingsSchema>>;

type Connection = { host: string; port: number; security: SmtpSecurity; username: string | null };

/**
 * A stored password is only sent to the server it was entered for. Whoever
 * points the settings somewhere else must type it again – otherwise a
 * hijacked admin account could redirect it to a server of their choosing.
 */
export function needsPasswordAgain(
  stored: (Connection & { hasPassword: boolean }) | null,
  next: Connection & { password: string; clearPassword: boolean },
): boolean {
  if (!stored?.hasPassword || next.password !== "" || next.clearPassword) return false;
  return (
    stored.host !== next.host ||
    stored.port !== next.port ||
    stored.security !== next.security ||
    stored.username !== next.username
  );
}
