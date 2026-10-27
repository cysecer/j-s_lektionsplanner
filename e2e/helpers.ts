import { execFileSync } from "node:child_process";
import type { Page } from "@playwright/test";
import { MAILPIT_URL, e2eServerEnv } from "./env";

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

type MailpitSummary = { ID: string; Subject: string };

/** Waits for the newest email to `to` matching `subject` and returns its text body. */
export async function waitForEmail(
  to: string,
  subject: RegExp,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=10`,
    );
    const { messages } = (await res.json()) as { messages: MailpitSummary[] };
    const hit = messages.find((m) => subject.test(m.Subject));
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
export async function acceptInvitation(page: Page, link: string, name: string) {
  await page.goto(link);
  await page.getByLabel("Dein Name").fill(name);
  await page.getByRole("button", { name: "Einladung annehmen" }).click();
  await page.waitForURL("**/welcome");
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
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
