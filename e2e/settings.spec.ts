import type { Page } from "@playwright/test";
import sharp from "sharp";
import { expect, newDevice, test } from "./fixtures";
import {
  acceptInvitation,
  countEmails,
  invite,
  nextServerAction,
  uniqueEmail,
  waitForEmail,
} from "./helpers";

async function asNewAdmin(page: Page, name = "Admin Test") {
  await acceptInvitation(page, invite(uniqueEmail("admin"), "ADMIN"), name);
  await page.getByRole("button", { name: "Später" }).click();
}

/**
 * Confirms a dialog and waits until it has closed, which happens only after
 * the action finished. (While it is open the rest of the page is aria-hidden,
 * so "item is gone" checks would pass too early.)
 */
async function confirm(page: Page, name: string | RegExp) {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name }).click();
  await expect(dialog).toBeHidden();
}

test("club: validated settings and logo upload", async ({ page }) => {
  await asNewAdmin(page);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings\/club$/);

  const duration = page.getByLabel("Standard-Lektionsdauer (Minuten)");
  await duration.fill("0");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Bitte mindestens 1 eingeben." }),
  ).toBeVisible();

  await duration.fill("75");
  await page.getByLabel("Standard-Startzeit").fill("17:30");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Standard-Lektionsdauer (Minuten)")).toHaveValue("75");
  await expect(page.getByLabel("Standard-Startzeit")).toHaveValue("17:30");

  // A disguised HTML file is refused by content, not by its name.
  // (The first upload field is the logo, the second the favicon.)
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("<!doctype html><script>alert(1)</script>".padEnd(200)),
  });
  await expect(page.getByText(/Dieses Dateiformat wird nicht unterstützt/)).toBeVisible();

  const png = await sharp({
    create: {
      width: 1600,
      height: 800,
      channels: 4,
      background: { r: 30, g: 80, b: 160, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  await fileInput.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  const logo = page.getByRole("img", { name: /^Logo von / });
  await expect(logo).toBeVisible();
  // Stored scaled down to at most 1024 px.
  const size = await logo.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  expect(size).toEqual([1024, 512]);

  await page.getByRole("button", { name: "Logo entfernen" }).click();
  await confirm(page, "Logo entfernen");
  await expect(page.getByText("Noch kein Logo hochgeladen.")).toBeVisible();
});

test("teams: create, reorder, delete unused, archive used, restore", async ({ page }) => {
  await asNewAdmin(page);
  await page.goto("/settings/teams");

  await page.getByRole("button", { name: "Riege hinzufügen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name der Riege").fill("Leichtathletik");
  await dialog.getByLabel(/Eigene Startzeit/).fill("17:00");
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog).toBeHidden();

  const list = page.getByRole("main").getByRole("listitem");
  await expect(list.filter({ hasText: "Leichtathletik" })).toContainText("17:00");
  const teamNames = () => page.getByRole("main").locator("li p.font-medium").allTextContents();
  // Other tests may have added teams too: compare with the position before.
  const before = await teamNames();
  const moved = nextServerAction(page);
  await page.getByRole("button", { name: "Leichtathletik: Nach oben" }).click();
  await moved;
  await page.reload();
  const after = await teamNames();
  expect(after.indexOf("Leichtathletik")).toBe(before.indexOf("Leichtathletik") - 1);
  expect(after[after.indexOf("Leichtathletik") + 1]).toBe(
    before[before.indexOf("Leichtathletik") - 1],
  );

  // Unused → really deleted.
  await page.getByRole("button", { name: "Leichtathletik: Löschen" }).click();
  await confirm(page, "Löschen");
  await expect(page.getByText("«Leichtathletik» wurde gelöscht.")).toBeVisible();

  // "Kids" is used by the demo lesson → archived, not deleted, and restorable.
  await page.getByRole("button", { name: "Kids: Löschen" }).click();
  await confirm(page, "Löschen");
  await expect(
    page.getByText("«Kids» wurde archiviert, weil sie noch verwendet wird."),
  ).toBeVisible();
  const archived = page.getByRole("heading", { name: "Archivierte Riegen" }).locator("..");
  await expect(archived.getByText("Kids")).toBeVisible();
  await page.getByRole("combobox", { name: "Riege" }).click();
  await expect(page.getByRole("option", { name: "Kids" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await archived.getByRole("button", { name: "Wiederherstellen" }).click();
  await expect(page.getByRole("heading", { name: "Archivierte Riegen" })).toHaveCount(0);
});

test("coaches, categories, sections and custom fields", async ({ page }) => {
  await asNewAdmin(page);

  await page.goto("/settings/coaches");
  await page.getByRole("button", { name: "Leiter/-in hinzufügen" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Patricia Probe");
  await dialog.getByLabel("TuVo").check();
  await dialog.getByRole("button", { name: "Speichern" }).click();
  const coach = page.getByRole("main").getByRole("listitem").filter({ hasText: "Patricia Probe" });
  await expect(coach).toContainText("TuVo");
  await page.getByRole("button", { name: "Patricia Probe: Löschen" }).click();
  await confirm(page, "Löschen");
  await expect(page.getByText("«Patricia Probe» wurde gelöscht.")).toBeVisible();

  await page.goto("/settings/tags");
  await page.getByLabel("Name der Kategorie").fill("Staffette");
  await page.getByRole("button", { name: "Kategorie hinzufügen" }).click();
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: "Staffette" }),
  ).toContainText("nicht verwendet");
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: "Ballspiel" }),
  ).toContainText(/in \d+ Programmblöcken/);
  await page.getByRole("button", { name: "Staffette: Löschen" }).click();
  await confirm(page, "Löschen");
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: "Staffette" }),
  ).toHaveCount(0);

  // Built-in sections: own name, then back to the translated default.
  await page.goto("/settings/sections");
  await page.getByRole("button", { name: "Einleitung: Bearbeiten" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Aufwärmen");
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: "Aufwärmen" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Aufwärmen: Bearbeiten" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: "Einleitung" }),
  ).toHaveCount(1);

  await page.goto("/settings/fields");
  await page.getByRole("button", { name: "Feld hinzufügen" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Bezeichnung").fill("Quelle");
  await dialog.getByRole("button", { name: "Speichern" }).click();
  const field = page.getByRole("main").getByRole("listitem").filter({ hasText: "Quelle" });
  await expect(field).toContainText("Kurzer Text");
  await expect(field).toContainText("In der Suche berücksichtigen");
  await page.getByRole("button", { name: "Quelle: Bearbeiten" }).click();
  await expect(
    page.getByRole("dialog").getByText(/kann nach dem Anlegen nicht mehr geändert/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Quelle: Löschen" }).click();
  await confirm(page, "Löschen");
  await expect(page.getByText("«Quelle» wurde gelöscht.")).toBeVisible();
});

test("people: invite, change role, remove signs the person out", async ({ page, browser }) => {
  await asNewAdmin(page, "Chefin Test");
  const email = uniqueEmail("member");

  await page.goto("/settings/people");
  await page.getByRole("button", { name: "Person einladen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("E-Mail-Adresse").fill("kein-mail");
  await dialog.getByRole("button", { name: "Einladung senden" }).click();
  await expect(dialog.getByText("Bitte gib eine gültige E-Mail-Adresse ein.")).toBeVisible();
  await dialog.getByLabel("E-Mail-Adresse").fill(email);
  await dialog.getByRole("button", { name: "Einladung senden" }).click();
  await expect(page.getByText(`Einladung an ${email} gesendet.`)).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: email }),
  ).toContainText("Leiter/-in");

  // The invited person accepts on their own device…
  const link = (await waitForEmail(email, /Einladung/)).match(/https?:\/\/\S+/)![0];
  const device = await newDevice(browser);
  const member = await device.newPage();
  await acceptInvitation(member, link.replace(/^http:\/\/localhost:\d+/, ""), "Max Mitglied");
  await member.getByRole("button", { name: "Später" }).click();
  await expect(member.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);

  // …the admin makes them a reader and then removes them.
  await page.reload();
  const row = page.getByRole("main").getByRole("listitem").filter({ hasText: "Max Mitglied" });
  await row.getByRole("combobox", { name: "Rolle" }).click();
  await page.getByRole("option", { name: /^Nur lesen/ }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();

  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Chefin Test" })
      .getByRole("button", { name: /Entfernen/ }),
  ).toHaveCount(0); // no self-removal

  await page.getByRole("button", { name: "Max Mitglied: Entfernen" }).click();
  await confirm(page, "Entfernen");
  await expect(
    page.getByRole("main").getByRole("listitem").filter({ hasText: "Max Mitglied" }),
  ).toHaveCount(0);

  await member.goto("/lessons");
  await expect(member).toHaveURL(/\/login/);
  // The account is gone entirely: a magic link request sends nothing.
  await member.getByLabel("E-Mail-Adresse").fill(email);
  await member.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(member.getByText("Schau in dein Postfach")).toBeVisible();
  await member.waitForTimeout(1500);
  expect(await countEmails(email)).toBe(1); // only the invitation
  await device.close();
});

test("coaches cannot open settings or upload a club logo", async ({ page }) => {
  await acceptInvitation(page, invite(uniqueEmail("coach"), "COACH"), "Cora Coach");
  await page.getByRole("button", { name: "Später" }).click();
  await page.goto("/settings/people");
  await expect(page).toHaveURL(/\/forbidden$/);

  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  const response = await page.request.post("/api/uploads?purpose=logo", {
    multipart: { file: { name: "x.png", mimeType: "image/png", buffer: png } },
  });
  expect(response.status()).toBe(403);
  const unknownPurpose = await page.request.post("/api/uploads?purpose=avatar", {
    multipart: { file: { name: "x.png", mimeType: "image/png", buffer: png } },
  });
  expect(unknownPurpose.status()).toBe(400);
});
