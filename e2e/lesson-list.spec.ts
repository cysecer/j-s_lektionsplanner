import type { Page } from "@playwright/test";
import { expect, newDevice, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";

async function signIn(page: Page, role: "ADMIN" | "COACH", name: string) {
  await acceptInvitation(page, invite(uniqueEmail(role.toLowerCase()), role), name);
  await page.getByRole("button", { name: "Später" }).click();
}

const saved = (page: Page) =>
  expect(page.getByText("Alle Änderungen gespeichert")).toBeVisible({ timeout: 10_000 });

/** Creates a lesson (optionally dated) and leaves its editor open. */
async function newLesson(page: Page, title: string, date?: string) {
  await page.goto("/lessons");
  await page.getByRole("button", { name: "Neue Lektionsvorbereitung" }).first().click();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  await page.getByLabel("Lektionstitel").fill(title);
  if (date) {
    await page.getByLabel("Datum", { exact: true }).fill(date);
    await page.getByLabel("Datum", { exact: true }).press("Enter");
  }
  await saved(page);
}

test("date and time fields: dd.MM.yyyy with weekday, 24 h", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page, "COACH", "Dora Datum");
  await newLesson(page, `Datumstest ${stamp}`);

  const date = page.getByLabel("Datum", { exact: true });
  await date.fill("4.12.30");
  await date.press("Tab");
  await expect(date).toHaveValue("04.12.2030");
  await expect(page.getByText("Mi", { exact: true })).toBeVisible();

  // The calendar starts the week on Monday and works with mouse and keyboard.
  await page.getByRole("button", { name: "Kalender öffnen" }).first().click();
  const calendar = page.getByRole("dialog", { name: "Kalender" });
  await expect(calendar.getByRole("columnheader").first()).toHaveText("Mo");
  await expect(calendar.getByRole("columnheader").last()).toHaveText("So");
  await expect(calendar.getByText("Dezember 2030")).toBeVisible();
  await calendar.getByRole("button", { name: "Freitag, 6. Dezember 2030" }).click();
  await expect(calendar).toBeHidden();
  await expect(date).toHaveValue("06.12.2030");
  await page.getByRole("button", { name: "Kalender öffnen" }).first().click();
  await expect(calendar.getByRole("button", { name: "Freitag, 6. Dezember 2030" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(date).toHaveValue("04.12.2030");

  const time = page.getByLabel("Startzeit");
  await time.fill("1730");
  await time.press("Tab");
  await expect(time).toHaveValue("17:30");
  await time.fill("25:00");
  await time.press("Tab");
  await expect(page.getByText("Bitte im Format HH:MM eingeben").first()).toBeVisible();
  await time.fill("9");
  await time.press("Tab");
  await expect(time).toHaveValue("09:00");
  await saved(page);

  await page.reload();
  await expect(date).toHaveValue("04.12.2030");
  await expect(time).toHaveValue("09:00");

  // Label and field of the four "Allgemeine Angaben" fields line up.
  const boxes = await Promise.all(
    ["Datum", "Startzeit", "Lektionsdauer (Minuten)", "Riege"].map((label) =>
      page.getByRole("main").getByLabel(label, { exact: true }).boundingBox(),
    ),
  );
  const tops = boxes.map((b) => Math.round(b!.y));
  expect(new Set(tops).size, `field tops ${tops.join(", ")}`).toBe(1);
});

test("lesson list: upcoming and past, search in title and goals, creator, delete", async ({
  page,
}) => {
  const stamp = Date.now();
  await signIn(page, "COACH", "Fritz Filter");
  const title = `Zukunft ${stamp}`;
  await newLesson(page, title, "01.12.2030");
  await page.getByText("Weitere Angaben").click();
  await page.getByRole("textbox", { name: "Zielsetzungen / Lernziele" }).fill(`Ballgefühl${stamp}`);
  await saved(page);
  await expect(page.getByText("Erstellt von Fritz Filter am")).toBeVisible();

  await page.goto("/lessons?team=all");
  await expect(page.getByRole("link", { name: /Kommende/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText("So 01.12.2030");
  await expect(row).toContainText("von Fritz Filter");
  // The 2018 sample is in the past.
  await expect(page.getByRole("link", { name: /28\.11\.2018/ })).toHaveCount(0);

  // Search finds the text inside the goals.
  await page.getByRole("searchbox", { name: "Suche" }).fill(`ballgefühl${stamp}`);
  await page.getByRole("button", { name: "Anwenden" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 Lektion" })).toBeVisible();
  await expect(row).toBeVisible();
  await page.getByRole("link", { name: "Zurücksetzen" }).click();
  await expect(page.getByRole("searchbox", { name: "Suche" })).toHaveValue("");

  // Past tab with a date range.
  await page.getByRole("link", { name: /Vergangene/ }).click();
  await expect(page).toHaveURL(/when=past/);
  await page.getByLabel("Von").fill("1.11.2018");
  await page.getByLabel("Bis").fill("30.11.2018");
  await page.getByLabel("Bis").press("Tab");
  await page.getByRole("button", { name: "Anwenden" }).click();
  await expect(page).toHaveURL(/from=2018-11-01.*to=2018-11-30|to=2018-11-30.*from=2018-11-01/);
  await expect(page.getByRole("link", { name: /Mi 28\.11\.2018/ })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);

  // Coaches delete single lessons, but cannot select several.
  await page.goto("/lessons?team=all");
  await expect(page.getByText("Alle auf dieser Seite auswählen")).toHaveCount(0);
  await row.getByRole("button", { name: `${title}: Löschen` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
  await expect(page.getByText(`«${title}» wurde gelöscht.`)).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("admins select several lessons and delete them together", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page, "ADMIN", "Alma Auswahl");
  const titles = [`Weg A ${stamp}`, `Weg B ${stamp}`, `Bleibt ${stamp}`];
  for (const title of titles) await newLesson(page, title, "02.12.2030");

  await page.goto(`/lessons?team=all&q=${stamp}`);
  await expect(page.getByRole("status").filter({ hasText: "3 Lektionen" })).toBeVisible();
  await page.getByRole("checkbox", { name: "«Weg A " + stamp + "» auswählen" }).check();
  await page.getByRole("checkbox", { name: "«Weg B " + stamp + "» auswählen" }).check();
  await page.getByRole("button", { name: "2 Lektionen löschen" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "2 Lektionen löschen" }).click();
  await expect(page.getByText("2 Lektionen gelöscht.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "1 Lektion" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Bleibt ${stamp}`) })).toBeVisible();

  // "Select all" picks every lesson on the page.
  await page.getByText("Alle auf dieser Seite auswählen").click();
  await expect(page.getByRole("button", { name: "1 Lektion löschen" })).toBeVisible();
});

test("teams with private drafts show a draft only to its creator until published", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const team = `Privat ${stamp}`;
  const title = `Geheimplan ${stamp}`;

  const adminDevice = await newDevice(browser);
  const admin = await adminDevice.newPage();
  await signIn(admin, "ADMIN", "Paula Privat");
  await admin.goto("/settings/teams");
  await admin.getByRole("button", { name: "Riege hinzufügen" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Name der Riege").fill(team);
  await dialog.getByText("Entwürfe nur für die erstellende Person sichtbar").click();
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(admin.getByText(`${team}`).first()).toBeVisible();
  await expect(admin.getByText("Entwürfe privat").first()).toBeVisible();

  // Coach A plans a draft in that team.
  await signIn(page, "COACH", "Anton Autor");
  await newLesson(page, title, "03.12.2030");
  await page.getByRole("main").getByLabel("Riege", { exact: true }).selectOption({ label: team });
  await saved(page);
  await expect(page.getByText("nur für dich sichtbar, bis du veröffentlichst")).toBeVisible();
  const url = page.url();

  // Coach B sees nothing of it – neither in the list nor by its address.
  const otherDevice = await newDevice(browser);
  const other = await otherDevice.newPage();
  await signIn(other, "COACH", "Berta Blick");
  await other.goto(`/lessons?team=all&q=${stamp}`);
  await expect(other.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
  const hidden = await other.goto(url);
  expect(hidden?.status()).toBe(404);

  // Admins see every draft.
  await admin.goto(`/lessons?team=all&q=${stamp}`);
  await expect(admin.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  // Publishing makes it visible.
  await page.getByRole("button", { name: "Veröffentlichen" }).click();
  await expect(page.getByText("Lektion ist veröffentlicht und für alle sichtbar.")).toBeVisible();
  await other.goto(`/lessons?team=all&q=${stamp}`);
  await expect(other.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  await otherDevice.close();
  await adminDevice.close();
});
