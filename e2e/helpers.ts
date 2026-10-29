import { execFileSync } from "node:child_process";
import type { Page } from "@playwright/test";
import { E2E_APP_URL, MAILPIT_URL, e2eServerEnv } from "./env";

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.ch`;
}

/** Creates an invitation through the real CLI and returns the link. */
export function invite(email: string, role: "ADMIN" | "COACH" | "READER" = "COACH"): string {
  const output = execFileSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "--conditions=react-server",
      "scripts/invite.ts",
      "--email",
      email,
      "--role",
      role,
    ],
    { env: { ...process.env, ...e2eServerEnv() }, encoding: "utf8" },
  );
  const match = output.match(/Link \(valid 7 days\): (\S+)/);
  if (!match) throw new Error(`No invitation link in output:\n${output}`);
  return match[1]!;
}

type MailpitSummary = { ID: string; Subject: string; Created: string };

/** Waits for the newest email to `to` matching `subject` and returns its text body. */
export async function waitForEmail(
  to: string,
  subject: RegExp,
  timeoutMs = 15_000,
  since = 0,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=10`,
    );
    const { messages } = (await res.json()) as { messages: MailpitSummary[] };
    const hit = messages.find(
      (m) => subject.test(m.Subject) && new Date(m.Created).getTime() >= since - 1000,
    );
    if (hit) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${hit.ID}`)).json()) as {
        Text: string;
      };
      return message.Text;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email to ${to} matching ${subject}`);
}

export async function countEmails(to: string): Promise<number> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  return ((await res.json()) as { messages_count: number }).messages_count;
}

export function firstLink(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`No link in email:\n${text}`);
  return match[0];
}

/** Accepts an invitation in the browser and skips the passkey prompt. */
export async function acceptInvitation(
  page: Page,
  link: string,
  name: string,
  labels = { nameLabel: "Dein Name", accept: "Einladung annehmen" },
) {
  await page.goto(link);
  await page.getByLabel(labels.nameLabel).fill(name);
  await page.getByRole("button", { name: labels.accept }).click();
  await page.waitForURL("**/welcome");
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /^Angemeldet als / }).click();
  await page.getByRole("menuitem", { name: "Abmelden" }).click();
  await page.waitForURL("**/login");
}

/** Chromium virtual authenticator: behaves like Face ID / Windows Hello. */
export async function addVirtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

/** Signs in through the magic link sent to Mailpit. */
export async function signInWithMagicLink(page: Page, email: string) {
  const before = Date.now();
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await page.getByText("Schau in dein Postfach").waitFor();
  const link = firstLink(await waitForEmail(email, /Anmeldelink/, 15_000, before)).replace(
    /^http:\/\/localhost:\d+/,
    E2E_APP_URL,
  );
  await page.goto(link);
}

/** Resolves when the next server action request has completed. */
export function nextServerAction(page: Page) {
  return page.waitForResponse(
    (r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined,
  );
}

/**
 * Opens a new lesson and stores it with "Entwurf speichern"; afterwards the
 * editor saves automatically. Leaves the editor of the stored lesson open.
 */
export async function createLesson(page: Page, title: string) {
  await page.goto("/lessons");
  await page.getByRole("link", { name: "Neue Lektionsvorbereitung" }).first().click();
  await page.waitForURL(/\/lessons\/new$/);
  await page.getByLabel("Lektionstitel").fill(title);
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);
}
