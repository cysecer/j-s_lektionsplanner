import "dotenv/config";

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_DATABASE = "lektionsplaner_e2e";
export const E2E_APP_URL = `http://localhost:${E2E_PORT}`;
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

function devDatabaseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
  return new URL(raw);
}

export function e2eDatabaseUrl(): string {
  const url = devDatabaseUrl();
  url.pathname = `/${E2E_DATABASE}`;
  return url.toString();
}

/** Maintenance database used to drop/create the e2e database. */
export function adminDatabaseUrl(): string {
  const url = devDatabaseUrl();
  url.pathname = "/postgres";
  return url.toString();
}

/** Environment for the app server and scripts during e2e runs. */
export function e2eServerEnv(): Record<string, string> {
  return {
    DATABASE_URL: e2eDatabaseUrl(),
    APP_URL: E2E_APP_URL,
    ALLOW_INSECURE_APP_URL: "true",
    AUTH_MAX_FAILED_SIGNINS: "3",
    SMTP_REQUIRE_TLS: "false",
    PORT: String(E2E_PORT),
  };
}
