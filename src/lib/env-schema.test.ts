import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-schema";

const valid = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
};

describe("parseEnv", () => {
  it("accepts a complete configuration and defaults NODE_ENV", () => {
    expect(parseEnv(valid)).toEqual({ ...valid, NODE_ENV: "development" });
  });

  it("rejects a missing variable and names it", () => {
    expect(() => parseEnv({ APP_URL: valid.APP_URL })).toThrow(/DATABASE_URL/);
  });

  it("rejects a database URL with a foreign protocol", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "mysql://u:p@localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a non-http app URL", () => {
    expect(() => parseEnv({ ...valid, APP_URL: "javascript:alert(1)" })).toThrow(/APP_URL/);
  });
});
