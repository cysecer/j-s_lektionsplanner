import { test as base, expect, type Browser } from "@playwright/test";

let counter = 0;

/** A distinct client IP per test (TEST-NET-3, RFC 5737), so IP rate limits stay realistic. */
export function nextClientIp(): string {
  counter += 1;
  return `203.0.113.${((process.pid + counter) % 250) + 1}`;
}

export const test = base.extend<{ cspViolations: string[] }>({
  // (`provide` is Playwright's fixture callback, usually called `use`.)
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": nextClientIp() });
  },
  // Every test fails if the browser blocked anything because of the Content
  // Security Policy, so the whole suite checks the policy against real use.
  cspViolations: [
    async ({ context }, provide) => {
      const violations: string[] = [];
      context.on("console", (message) => {
        if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
          violations.push(message.text());
        }
      });
      await provide(violations);
      expect(violations, "blocked by the Content Security Policy").toEqual([]);
    },
    { auto: true },
  ],
});

/** A second device with its own cookies and IP. */
export function newDevice(browser: Browser) {
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": nextClientIp() } });
}

export { expect } from "@playwright/test";
