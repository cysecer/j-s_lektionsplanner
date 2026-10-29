import "server-only";
import { chromium, type Browser } from "playwright-core";
import { env } from "@/lib/env";

/**
 * Prints a page of this app to PDF with headless Chromium. The PDF only
 * ever exists in memory: nothing is written to disk.
 *
 * One browser is shared and started on first use; every PDF gets its own
 * isolated context (no cookies, no cache, no JavaScript) that may only
 * talk to the app itself. At most PDF_CONCURRENCY renders run at a time.
 */

export const internalBaseUrl = () => new URL(env.INTERNAL_APP_URL ?? env.APP_URL);

let browser: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = chromium
      .launch({ headless: true, args: ["--disable-dev-shm-usage"] })
      .then((b) => {
        b.on("disconnected", () => {
          browser = null;
        });
        return b;
      })
      .catch((error: unknown) => {
        browser = null;
        throw error;
      });
  }
  return browser;
}

// A tiny semaphore: renders beyond the limit wait for a free slot.
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= env.PDF_CONCURRENCY) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const RENDER_TIMEOUT_MS = 45_000;

/** Rejects after `ms`; the caller's finally block then closes the context. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("PDF rendering timed out")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export async function renderPdf(options: {
  /** Path on this app, e.g. /print/lessons/…?token=… */
  path: string;
  locale: string;
  localeCookie: string;
  footerTemplate: string;
}): Promise<Buffer> {
  const base = internalBaseUrl();
  return slot(async () => {
    const context = await (
      await getBrowser()
    ).newContext({
      javaScriptEnabled: false,
      locale: options.locale,
      serviceWorkers: "block",
    });
    try {
      // Render in the reader's language (the print page has no session).
      await context.addCookies([
        { name: options.localeCookie, value: options.locale, url: base.origin },
      ]);
      // Only the app itself: fonts and CSS. Images are inlined by the page.
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
      );
      const page = await context.newPage();
      return await withTimeout(
        (async () => {
          const response = await page.goto(new URL(options.path, base).toString(), {
            waitUntil: "load",
          });
          if (!response?.ok()) throw new Error(`Print page answered ${response?.status()}`);
          return page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: "<span></span>",
            footerTemplate: options.footerTemplate,
            margin: { top: "12mm", right: "10mm", bottom: "16mm", left: "16mm" },
          });
        })(),
        RENDER_TIMEOUT_MS,
      );
    } finally {
      await context.close();
    }
  });
}
