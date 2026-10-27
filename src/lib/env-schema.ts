import { z } from "zod";

const intFromString = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url({ protocol: /^https?$/ }),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  /** Signs session cookies and tokens. Generate with `openssl rand -base64 48`. */
  AUTH_SECRET: z.string().min(32),
  /** Sliding session: signed out after this much inactivity. */
  SESSION_IDLE_MINUTES: intFromString(5, 60 * 24 * 30).default(60),
  /** Absolute session lifetime regardless of activity. */
  SESSION_MAX_HOURS: intFromString(1, 24 * 30).default(12),
  /** Failed password attempts before the account is temporarily locked. */
  AUTH_MAX_FAILED_SIGNINS: intFromString(3, 100).default(10),
  AUTH_LOCKOUT_MINUTES: intFromString(1, 24 * 60).default(15),
  /**
   * Reverse proxies in front of the app (comma-separated IPs/CIDRs), so the
   * real client IP can be read from X-Forwarded-For for rate limiting.
   */
  TRUSTED_PROXIES: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.union([z.cidrv4(), z.cidrv6(), z.ipv4(), z.ipv6()])).max(20)),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: intFromString(1, 65535),
  /** true = implicit TLS (port 465). STARTTLS is used automatically otherwise. */
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Refuse to send unless the connection is encrypted. Only disable for a local test server. */
  SMTP_REQUIRE_TLS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** e.g. "Lektionsplaner <noreply@example.ch>" */
  MAIL_FROM: z.string().min(3),

  /** Only for running a production build locally (e2e tests). Never set on a server. */
  ALLOW_INSECURE_APP_URL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    if (!parsed.data.APP_URL.startsWith("https://") && !parsed.data.ALLOW_INSECURE_APP_URL) {
      throw new Error(
        "Invalid environment configuration:\n  - APP_URL: must use https in production",
      );
    }
    if (parsed.data.AUTH_SECRET.includes("change-me")) {
      throw new Error(
        "Invalid environment configuration:\n  - AUTH_SECRET: replace the placeholder from .env.example",
      );
    }
  }
  return parsed.data;
}
