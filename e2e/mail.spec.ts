import type { Page } from "@playwright/test";
import { MAILPIT_URL } from "./env";
import { expect, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";
import { readPdf } from "./pdf-helpers";

type MailpitMessage = {
  ID: string;
  From: { Name: string; Address: string };
  ReplyTo: { Address: string }[];
  To: { Address: string }[];
  Subject: string;
  Text: string;
  Attachments: { PartID: string; FileName: string; ContentType: string }[];
};

async function signIn(page: Page, role: "ADMIN" | "COACH" | "READER", name: string) {
  const email = uniqueEmail(role.toLowerCase());
  await acceptInvitation(page, invite(email, role), name);
  await page.getByRole("button", { name: "Später" }).click();
  return email;
}

/** The newest message to `to` matching `subject`, with headers and attachments. */
async function waitForMessage(to: string, subject: RegExp): Promise<MailpitMessage> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=10`,
    );
    const { messages } = (await res.json()) as { messages: { ID: string; Subject: string }[] };
    const hit = messages.find((m) => subject.test(m.Subject));
    if (hit)
      return (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${hit.ID}`)
      ).json()) as MailpitMessage;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email to ${to} matching ${subject}`);
}

test("admins set the mail server; the password is stored but never shown again", async ({
  page,
}) => {
  const adminEmail = await signIn(page, "ADMIN", "Mira Mail");
  const secret = `Geheim-${Date.now()}-Passwort`;
  await page.goto("/settings/mail");
  await expect(page.getByRole("status").filter({ hasText: "Standard des Servers" })).toBeVisible();

  const host = page.getByLabel("Server (SMTP)");
  const password = page.getByLabel("Passwort", { exact: true });
  await host.fill("smtp://localhost");
  await page.getByLabel("Absender-Adresse").fill("verein@example.ch");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Bitte nur den Servernamen eingeben").first()).toBeVisible();

  await host.fill("localhost");
  await page.getByLabel("Port").fill("5432");
  await page.getByRole("combobox", { name: "Verschlüsselung" }).click();
  await page.getByRole("option", { name: /^Keine/ }).click();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Bitte einen Mail-Port wählen").first()).toBeVisible();

  await page.getByLabel("Port").fill("1025");
  await page.getByLabel("Benutzername (optional)").fill("verein");
  await password.fill(secret);
  await page.getByLabel("Absender-Name (optional)").fill("TV E2E");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.").first()).toBeVisible();

  try {
    // After a reload: stored, but neither in the field nor anywhere in the page.
    await page.reload();
    await expect(
      page.getByRole("status").filter({ hasText: "Mailserver des Vereins" }),
    ).toBeVisible();
    await expect(password).toHaveValue("");
    await expect(password).toHaveAttribute("placeholder", "Gespeichert");
    expect(await page.content()).not.toContain(secret);

    // Pointing the settings elsewhere needs the password again.
    await host.fill("127.0.0.1");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("bitte gib das Passwort nochmals ein").first()).toBeVisible();
    await host.fill("localhost");

    // The test mail goes through the club's server (Mailpit offers no AUTH,
    // so the stored credentials are simply not used here).
    await page.getByRole("button", { name: "Testmail an mich senden" }).click();
    await expect(page.getByText(`Testmail an ${adminEmail} gesendet.`)).toBeVisible();
    const mail = await waitForMessage(adminEmail, /Testmail vom Lektionsplaner/);
    expect(mail.From).toEqual({ Name: "TV E2E", Address: "verein@example.ch" });
    expect(mail.Text).toContain("Hallo Mira Mail");
    expect(JSON.stringify(mail)).not.toContain(secret);
  } finally {
    // Back to the server default for the other tests.
    await page.getByRole("button", { name: "Eigenen Mailserver entfernen" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Eigenen Mailserver entfernen" })
      .click();
    await expect(page.getByText("Mailserver entfernt.")).toBeVisible();
  }
});

test("coaches send a lesson by email with the PDF attached", async ({ page }) => {
  test.setTimeout(120_000);
  const coachEmail = await signIn(page, "COACH", "Carla Mail");
  const anna = uniqueEmail("anna");
  const ben = uniqueEmail("ben");
  await page.goto("/lessons?team=all");
  await page.getByRole("link", { name: /28\.11\.2018/ }).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Per E-Mail senden" }).click();
  const dialog = page.getByRole("dialog", { name: "Lektion per E-Mail senden" });
  await expect(dialog.getByLabel("Betreff")).toHaveValue(/28\.11\.2018/);
  await expect(dialog.getByLabel("Nachricht")).toHaveValue(/Carla Mail/);
  await expect(dialog.getByText("2018-11-28_Lektionsvorbereitung_Kids_Spiele.pdf")).toBeVisible();

  const to = dialog.getByLabel("An", { exact: true });
  await to.fill("kein-mail");
  await to.press("Enter");
  await expect(dialog.getByText("«kein-mail» ist keine gültige E-Mail-Adresse.")).toBeVisible();
  await to.fill(`${anna}, ${ben}`);
  await to.press("Enter");
  await expect(dialog.getByRole("button", { name: `${anna} entfernen` })).toBeVisible();
  await expect(dialog.getByRole("button", { name: `${ben} entfernen` })).toBeVisible();
  await dialog.getByLabel("Nachricht").fill("Hallo zusammen\n\nBis Mittwoch!\nCarla");

  await dialog.getByRole("button", { name: "Vorschau anzeigen" }).click();
  const preview = dialog.getByRole("region", { name: "Vorschau" });
  await expect(preview).toContainText(coachEmail);
  await expect(preview).toContainText("Bis Mittwoch!");
  await expect(preview).toContainText("Antworten gehen direkt an");

  await dialog.getByRole("button", { name: "Senden" }).click();
  await expect(page.getByText("E-Mail an 2 Personen gesendet.")).toBeVisible({ timeout: 60_000 });
  await expect(dialog).toBeHidden();

  const mail = await waitForMessage(anna, /Lektionsvorbereitung vom 28\.11\.2018/);
  expect(mail.To.map((t) => t.Address).sort()).toEqual([anna, ben].sort());
  expect(mail.ReplyTo.map((r) => r.Address)).toEqual([coachEmail]);
  expect(mail.Text).toContain("Bis Mittwoch!");
  expect(mail.Attachments).toHaveLength(1);
  const [attachment] = mail.Attachments;
  expect(attachment).toMatchObject({
    FileName: "2018-11-28_Lektionsvorbereitung_Kids_Spiele.pdf",
    ContentType: "application/pdf",
  });
  const pdf = await (
    await fetch(`${MAILPIT_URL}/api/v1/message/${mail.ID}/part/${attachment!.PartID}`)
  ).arrayBuffer();
  const text = (await readPdf(new Uint8Array(pdf))).map((p) => p.text).join("\n");
  expect(text).toContain("Heigositzball");

  // The dialog shows what was sent.
  await page.getByRole("button", { name: "Per E-Mail senden" }).click();
  await expect(
    dialog.getByRole("region", { name: "Bisher gesendet" }).getByText(`von Carla Mail an`),
  ).toBeVisible();
});

test("readers cannot send emails", async ({ page }) => {
  await signIn(page, "READER", "Rita Reader");
  await page.goto("/lessons?team=all");
  await page.getByRole("link", { name: /28\.11\.2018/ }).click();
  await expect(page.getByRole("button", { name: "PDF herunterladen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Per E-Mail senden" })).toHaveCount(0);
});
