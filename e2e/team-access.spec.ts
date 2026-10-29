import type { Page } from "@playwright/test";
import { expect, newDevice, test } from "./fixtures";
import { acceptInvitation, createLesson, invite, uniqueEmail } from "./helpers";

const saved = (page: Page) =>
  expect(page.getByText("Alle Änderungen gespeichert")).toBeVisible({ timeout: 10_000 });

async function addTeam(admin: Page, name: string) {
  await admin.goto("/settings/teams");
  await admin.getByRole("button", { name: "Riege hinzufügen" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Name der Riege").fill(name);
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog).toBeHidden();
}

async function lessonInTeam(admin: Page, title: string, team: string) {
  await createLesson(admin, title);
  await admin.getByRole("main").getByLabel("Riege", { exact: true }).selectOption({ label: team });
  await saved(admin);
  return admin.url();
}

test("roles per team: coach in one, reader in another, the rest invisible", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const coachTeam = `Leiten ${stamp}`;
  const readTeam = `Lesen ${stamp}`;
  const hiddenTeam = `Verborgen ${stamp}`;

  const adminDevice = await newDevice(browser);
  const admin = await adminDevice.newPage();
  await acceptInvitation(admin, invite(uniqueEmail("admin"), "ADMIN"), "Ada Rechte");
  await admin.getByRole("button", { name: "Später" }).click();
  for (const team of [coachTeam, readTeam, hiddenTeam]) await addTeam(admin, team);
  const urls = {
    coach: await lessonInTeam(admin, `Planbar ${stamp}`, coachTeam),
    read: await lessonInTeam(admin, `Lesbar ${stamp}`, readTeam),
    hidden: await lessonInTeam(admin, `Unsichtbar ${stamp}`, hiddenTeam),
  };

  // Invite with a role per team.
  const email = uniqueEmail("mixed");
  await admin.goto("/settings/people");
  await admin.getByRole("button", { name: "Person einladen" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("E-Mail-Adresse").fill(email);
  await dialog.getByRole("combobox", { name: "Rolle" }).click();
  await admin.getByRole("option", { name: /^Pro Riege festlegen/ }).click();
  // Nothing chosen yet: refused.
  await dialog.getByRole("button", { name: "Einladung senden" }).click();
  await expect(dialog.getByText("Bitte mindestens einer Riege eine Rolle geben.")).toBeVisible();
  await dialog.getByLabel(coachTeam).selectOption({ label: "Leiter/-in" });
  await dialog.getByLabel(readTeam).selectOption({ label: "Nur lesen" });
  await dialog.getByRole("button", { name: "Einladung senden" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    admin.getByRole("main").getByRole("listitem").filter({ hasText: email }),
  ).toContainText(`Leiter/-in: ${coachTeam} · Nur lesen: ${readTeam}`);
  const link = await admin.getByRole("main").getByRole("status").locator("code").textContent();

  await acceptInvitation(page, link!.trim(), "Mia Misch");
  await page.getByRole("button", { name: "Später" }).click();

  // The list shows the two teams' lessons, not the third.
  await page.goto(`/lessons?team=all&q=${stamp}`);
  await expect(page.getByRole("link", { name: new RegExp(`Planbar ${stamp}`) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Lesbar ${stamp}`) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Unsichtbar ${stamp}`) })).toHaveCount(0);
  // Only the coached lesson can be deleted.
  await expect(page.getByRole("button", { name: `Planbar ${stamp}: Löschen` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Lesbar ${stamp}: Löschen` })).toHaveCount(0);

  // The header team switcher offers only the two teams.
  await page.getByRole("banner").getByRole("combobox", { name: "Riege" }).click();
  await expect(page.getByRole("option", { name: coachTeam })).toBeVisible();
  await expect(page.getByRole("option", { name: readTeam })).toBeVisible();
  await expect(page.getByRole("option", { name: hiddenTeam })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Coach team: the editor. Reader team: the document only.
  await page.goto(urls.coach);
  await expect(page.getByLabel("Lektionstitel")).toBeVisible();
  await page.goto(urls.read);
  await expect(page.getByRole("button", { name: "PDF herunterladen" })).toBeVisible();
  await expect(page.getByLabel("Lektionstitel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Per E-Mail senden" })).toHaveCount(0);
  expect((await page.goto(urls.hidden))?.status()).toBe(404);

  // A new lesson lands in the coached team, and only that team is offered.
  await page.goto("/lessons");
  await page.getByRole("link", { name: "Neue Lektionsvorbereitung" }).first().click();
  await expect(page).toHaveURL(/\/lessons\/new$/);
  const teamSelect = page.getByRole("main").getByLabel("Riege", { exact: true });
  await expect(teamSelect.locator("option:checked")).toHaveText(coachTeam);
  await expect(teamSelect.locator("option", { hasText: readTeam })).toHaveCount(0);

  // The admin takes the reader team away: it disappears on the next request.
  await admin.reload();
  const row = admin.getByRole("main").getByRole("listitem").filter({ hasText: "Mia Misch" });
  await row.getByRole("button", { name: "Mia Misch: Riegen bearbeiten" }).click();
  const teamsDialog = admin.getByRole("dialog", { name: "Riegen von Mia Misch" });
  await teamsDialog.getByLabel(readTeam).selectOption({ label: "Kein Zugang" });
  await teamsDialog.getByRole("button", { name: "Speichern" }).click();
  await expect(teamsDialog).toBeHidden();
  await expect(row).toContainText(`Leiter/-in: ${coachTeam}`);
  await expect(row).not.toContainText(readTeam);

  await page.goto(`/lessons?team=all&q=${stamp}`);
  await expect(page.getByRole("link", { name: new RegExp(`Lesbar ${stamp}`) })).toHaveCount(0);
  expect((await page.goto(urls.read))?.status()).toBe(404);

  await adminDevice.close();
});
