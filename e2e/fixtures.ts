import { test as base, type Browser } from "@playwright/test";

let counter = 0;

/** A distinct client IP per test (TEST-NET-3, RFC 5737), so IP rate limits stay realistic. */
export function nextClientIp(): string {
  counter += 1;
  return `203.0.113.${((process.pid + counter) % 250) + 1}`;
}

export const test = base.extend({
  // (`provide` is Playwright's fixture callback, usually called `use`.)
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": nextClientIp() });
  },
});

/** A second device with its own cookies and IP. */
export function newDevice(browser: Browser) {
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": nextClientIp() } });
}

export { expect } from "@playwright/test";
