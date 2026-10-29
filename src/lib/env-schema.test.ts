import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-schema";

const valid = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  MAIL_FROM: "Lektionsplaner <noreply@example.ch>",
};

describe("parseEnv", () => {
  it("accepts a complete configuration and applies defaults", () => {
    expect(parseEnv(valid)).toMatchObject({
      NODE_ENV: "development",
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      SESSION_IDLE_MINUTES: 60,
      SESSION_MAX_HOURS: 12,
      AUTH_MAX_FAILED_SIGNINS: 10,
      AUTH_LOCKOUT_MINUTES: 15,
    });
  });

  it("treats the fallback mail server as optional, but complete", () => {
    const { SMTP_HOST, SMTP_PORT, MAIL_FROM, ...rest } = valid;
    expect([SMTP_HOST, SMTP_PORT, MAIL_FROM]).toHaveLength(3);
    expect(parseEnv(rest)).toMatchObject({ SMTP_PORT: 587 });
    expect(parseEnv(rest).SMTP_HOST).toBeUndefined();
    expect(parseEnv({ ...rest, SMTP_HOST: "", MAIL_FROM: "" }).SMTP_HOST).toBeUndefined();
    expect(() => parseEnv({ ...rest, SMTP_HOST: "localhost" })).toThrow(/MAIL_FROM/);
  });

  it("rejects a missing variable and names it", () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.DATABASE_URL;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("rejects a database URL with a foreign protocol", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "mysql://u:p@localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a non-http app URL", () => {
    expect(() => parseEnv({ ...valid, APP_URL: "javascript:alert(1)" })).toThrow(/APP_URL/);
  });

  it("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/);
  });

  it("rejects out-of-range numbers", () => {
    expect(() => parseEnv({ ...valid, SMTP_PORT: "70000" })).toThrow(/SMTP_PORT/);
    expect(() => parseEnv({ ...valid, AUTH_MAX_FAILED_SIGNINS: "1000" })).toThrow(
      /AUTH_MAX_FAILED_SIGNINS/,
    );
  });

  it("parses trusted proxies and rejects malformed entries", () => {
    expect(
      parseEnv({ ...valid, TRUSTED_PROXIES: "10.0.0.0/8, 172.18.0.1" }).TRUSTED_PROXIES,
    ).toEqual(["10.0.0.0/8", "172.18.0.1"]);
    expect(parseEnv(valid).TRUSTED_PROXIES).toEqual([]);
    expect(() => parseEnv({ ...valid, TRUSTED_PROXIES: "proxy.local" })).toThrow(/TRUSTED_PROXIES/);
  });

  it("rejects the placeholder secret in production", () => {
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        APP_URL: "https://planer.example.ch",
        AUTH_SECRET: "change-me-change-me-change-me-change-me",
      }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("requires https in production", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production" })).toThrow(/https/);
    expect(
      parseEnv({ ...valid, NODE_ENV: "production", APP_URL: "https://planer.example.ch" }).APP_URL,
    ).toBe("https://planer.example.ch");
  });
});
