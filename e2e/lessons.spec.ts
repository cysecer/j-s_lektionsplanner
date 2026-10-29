import type { Page } from "@playwright/test";
import { expect, newDevice, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";

async function signInAs(page: Page, role: "COACH" | "READER", name: string) {
  await acceptInvitation(page, invite(uniqueEmail(role.toLowerCase()), role), name);
  await page.getByRole("button", { name: "Später" }).click();
}

const saved = (page: Page) =>
  expect(page.getByText("Alle Änderungen gespeichert")).toBeVisible({ timeout: 10_000 });
const section = (page: Page, name: string) => page.getByRole("region", { name });
const itemTitles = async (page: Page, name: string) =>
  section(page, name)
    .locator("article")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));

async function newLesson(page: Page, title: string) {
  await page.goto("/lessons");
  await page.getByRole("button", { name: "Neue Lektionsvorbereitung" }).first().click();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  await page.getByLabel("Lektionstitel").fill(title);
  await saved(page);
}

async function addFromLibrary(page: Page, search: string, title: string) {
  const panel = page.getByRole("complementary");
  await panel.getByRole("searchbox", { name: "Programmblöcke durchsuchen" }).fill(search);
  await panel.getByRole("button", { name: `«${title}» hinzufügen` }).click();
  await expect(page.getByText(`«${title}» hinzugefügt.`)).toBeVisible();
}

test("plan a lesson: library, quick items, timing, autosave", async ({ page }) => {
  await signInAs(page, "COACH", "Lina Lektion");
  await newLesson(page, "Ballspiele");
  await page.getByLabel("Lektionsdauer (Minuten)").fill("60");
  await page.getByLabel("Startzeit").fill("17:30");

  // From the library: lands in its suggested section (Hauptteil).
  await addFromLibrary(page, "Keulen", "Keulenfussball");
  await addFromLibrary(page, "Matten", "Mattenfussball");
  expect(await itemTitles(page, "Hauptteil")).toEqual(["Keulenfussball", "Mattenfussball"]);

  // A quick one-off item in Einleitung.
  const intro = section(page, "Einleitung");
  await intro.getByRole("button", { name: "Kurzen Punkt erfassen" }).click();
  await intro.getByLabel("Titel").fill("Information Turnier");
  await intro.getByLabel("Minuten").fill("5");
  await intro.getByRole("button", { name: "Kurzen Punkt erfassen" }).click();
  await expect(intro.getByText("nur in dieser Lektion")).toBeVisible();

  // Timing: 5 + 20 + 20 = 45 of 60 → 15 left; clock times from 17:30.
  await expect(page.getByText("noch 15 Minuten frei")).toBeVisible();
  await expect(section(page, "Hauptteil").getByText("17:35")).toBeVisible();
  await expect(page.getByText("Ende 18:15")).toBeVisible();

  await page.getByLabel("Lektionsdauer (Minuten)").fill("40");
  await expect(page.getByText("5 Minuten zu lang")).toBeVisible();

  await saved(page);
  await page.reload();
  expect(await itemTitles(page, "Hauptteil")).toEqual(["Keulenfussball", "Mattenfussball"]);
  expect(await itemTitles(page, "Einleitung")).toEqual(["Information Turnier"]);
  await expect(page.getByLabel("Lektionstitel")).toHaveValue("Ballspiele");
});

test("reorder with buttons and keyboard, move between sections", async ({ page }) => {
  await signInAs(page, "COACH", "Rolf Reihe");
  await newLesson(page, "Reihenfolge");
  await addFromLibrary(page, "Keulen", "Keulenfussball");
  await addFromLibrary(page, "Matten", "Mattenfussball");
  await addFromLibrary(page, "Heigositzball", "Heigositzball");

  // Button
  await page.getByRole("button", { name: "Mattenfussball: Nach oben" }).click();
  expect(await itemTitles(page, "Hauptteil")).toEqual(["Mattenfussball", "Keulenfussball"]);

  // Keyboard drag & drop: space, arrow down, space.
  await section(page, "Hauptteil")
    .getByRole("button", { name: "«Mattenfussball» verschieben" })
    .focus();
  // Wait for each screen-reader announcement, like a user would hear it.
  const live = page.locator('[id^="DndLiveRegion"]');
  await page.keyboard.press("Space");
  await expect(live).toContainText("«Mattenfussball» ist über «Mattenfussball»");
  await page.keyboard.press("ArrowDown");
  await expect(live).toContainText("«Mattenfussball» ist über «Keulenfussball»");
  await page.keyboard.press("Space");
  await expect(live).toContainText("«Mattenfussball» abgelegt.");
  await expect
    .poll(() => itemTitles(page, "Hauptteil"))
    .toEqual(["Keulenfussball", "Mattenfussball"]);

  // Move to another section via the menu.
  await page.getByRole("button", { name: "Heigositzball: Verschieben nach …" }).click();
  await page.getByRole("menuitem", { name: "Einleitung" }).click();
  expect(await itemTitles(page, "Einleitung")).toEqual(["Heigositzball"]);
  expect(await itemTitles(page, "Ausklang")).toEqual([]);

  await saved(page);
  await page.reload();
  expect(await itemTitles(page, "Einleitung")).toEqual(["Heigositzball"]);
  expect(await itemTitles(page, "Hauptteil")).toEqual(["Keulenfussball", "Mattenfussball"]);
});

test("editing a library item asks where the change applies", async ({ page }) => {
  await signInAs(page, "COACH", "Edda Edit");
  await newLesson(page, "Änderungen");
  await page.getByLabel("Anwesende Leitende").getByRole("checkbox").first().check();
  await addFromLibrary(page, "Appell", "Appell");

  // Only the responsible person changes → no question, library untouched.
  await page.getByRole("button", { name: "Appell: Bearbeiten" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Verantwortlich").selectOption({ label: "Freier Text …" });
  await dialog.getByLabel("Name oder Beschreibung").fill("Gast-Leiterin");
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(dialog).toBeHidden();
  await expect(section(page, "Ausklang").getByLabel("Appell: Name oder Beschreibung")).toHaveValue(
    "Gast-Leiterin",
  );

  // Leaders are assigned right on the card, without opening the dialog.
  const leader = section(page, "Ausklang").getByLabel("Appell: Verantwortlich");
  await leader.selectOption({ label: "Marco Steiner" });
  await expect(section(page, "Ausklang").getByLabel("Appell: Name oder Beschreibung")).toHaveCount(
    0,
  );
  await saved(page);
  await page.reload();
  await expect(leader.locator("option:checked")).toHaveText("Marco Steiner");

  // Content change → choice: only for this training.
  await page.getByRole("button", { name: "Appell: Bearbeiten" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Dauer (Minuten)").fill("7");
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(dialog.getByText("Wo soll die Änderung gelten?")).toBeVisible();
  await dialog.getByRole("button", { name: /Nur für dieses Training/ }).click();
  await expect(section(page, "Ausklang").getByText("angepasst")).toBeVisible();

  // Invalid input is caught in the dialog before anything is saved.
  await page.getByRole("button", { name: "Appell: Bearbeiten" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Max. Anzahl Kinder").fill("999");
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(
    dialog.getByRole("alert").filter({ hasText: "Bitte höchstens 500 eingeben." }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Abbrechen" }).click();

  // Content change → save as a new library block.
  await page.getByRole("button", { name: "Appell: Bearbeiten" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name des Spiels / der Übung").fill("Appell mit Ausblick");
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await dialog.getByRole("button", { name: /Als neuen Programmblock speichern/ }).click();
  await expect(page.getByText("Neuer Programmblock in der Bibliothek gespeichert.")).toBeVisible();
  await saved(page);

  await page.goto("/blocks?q=Appell&team=all");
  await expect(page.getByRole("link", { name: /Appell mit Ausblick/ })).toBeVisible();
  await page
    .getByRole("link", { name: /^Appell\b(?! mit)/ })
    .first()
    .click();
  await expect(page.getByText("10 Minuten")).toBeVisible(); // original untouched
});

test("concurrent edits are detected instead of overwritten", async ({ page, browser }) => {
  await signInAs(page, "COACH", "Kurt Konflikt");
  await newLesson(page, "Gleichzeitig");
  const url = page.url();
  const cookies = await page.context().cookies();

  const other = await newDevice(browser);
  await other.addCookies(cookies);
  const second = await other.newPage();
  await second.goto(url);
  await expect(second.getByLabel("Lektionstitel")).toHaveValue("Gleichzeitig");

  await page.getByLabel("Lektionstitel").fill("Version A");
  await saved(page);
  await second.getByLabel("Lektionstitel").fill("Version B");
  await expect(second.getByText("Jemand anders hat diese Lektion geändert").first()).toBeVisible({
    timeout: 10_000,
  });
  await second.reload();
  await expect(second.getByLabel("Lektionstitel")).toHaveValue("Version A");
  await other.close();
});

test("duplicate a lesson; readers only see it", async ({ page, browser }) => {
  await signInAs(page, "COACH", "Dora Doppel");
  await newLesson(page, "Vorlage");
  await addFromLibrary(page, "Keulen", "Keulenfussball");
  await saved(page);
  await page.getByRole("button", { name: "Duplizieren" }).click();
  await expect(page.getByText("Kopie erstellt.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Lektionstitel")).toHaveValue("Vorlage");
  expect(await itemTitles(page, "Hauptteil")).toEqual(["Keulenfussball"]);
  const copyUrl = page.url();

  const readerDevice = await newDevice(browser);
  const reader = await readerDevice.newPage();
  await signInAs(reader, "READER", "Rita Reader");
  await reader.goto(copyUrl);
  await expect(reader.getByRole("heading", { name: "Vorlage", level: 1 })).toBeVisible();
  await expect(reader.getByText("Keulenfussball")).toBeVisible();
  await expect(reader.getByLabel("Lektionstitel")).toHaveCount(0);
  await expect(reader.getByRole("button", { name: "Neue Lektionsvorbereitung" })).toHaveCount(0);
  await readerDevice.close();
});

test("the sample lesson shows its six items in three sections", async ({ page }) => {
  await signInAs(page, "COACH", "Sam Sample");
  await page.goto("/lessons?team=all");
  // The demo lesson from the seed, dated like the paper original.
  await page.getByRole("link", { name: /28\.11\.2018/ }).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);
  await expect(section(page, "Einleitung").locator("article")).toHaveCount(2);
  expect(await itemTitles(page, "Einleitung")).toEqual([
    "Information Unihockey-Turnier",
    "Dschungelspiel (eine Art Keulenstehlen)",
  ]);
  expect(await itemTitles(page, "Ausklang")).toEqual(["Appell", "Heigositzball"]);
  await expect(page.getByText("passt genau")).toBeVisible();
});

/** Drags with real, gradual mouse movement (what dnd-kit's pointer sensor expects). */
async function drag(
  page: Page,
  from: import("@playwright/test").Locator,
  to: import("@playwright/test").Locator,
) {
  // Both ends must be on screen (the library column is sticky).
  await to.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 2, { steps: 4 });
  await page.mouse.up();
}

test("mouse drag: from the library into a section, and between sections", async ({ page }) => {
  await signInAs(page, "COACH", "Mia Maus");
  await newLesson(page, "Ziehen");
  await addFromLibrary(page, "Keulen", "Keulenfussball");

  const panel = page.getByRole("complementary");
  await panel.getByRole("searchbox", { name: "Programmblöcke durchsuchen" }).fill("Appell");
  await expect(panel.getByText("Mattenfussball")).toHaveCount(0); // results refreshed
  await drag(
    page,
    panel.getByRole("button", { name: "«Appell» verschieben" }),
    section(page, "Einleitung").getByText("Noch nichts geplant", { exact: false }),
  );
  await expect(page.getByText("«Appell» hinzugefügt.")).toBeVisible();
  expect(await itemTitles(page, "Einleitung")).toEqual(["Appell"]);

  await drag(
    page,
    section(page, "Hauptteil").getByRole("button", { name: "«Keulenfussball» verschieben" }),
    section(page, "Ausklang").getByText("Noch nichts geplant", { exact: false }),
  );
  await expect.poll(() => itemTitles(page, "Ausklang")).toEqual(["Keulenfussball"]);
  expect(await itemTitles(page, "Hauptteil")).toEqual([]);

  await saved(page);
  await page.reload();
  expect(await itemTitles(page, "Ausklang")).toEqual(["Keulenfussball"]);
});
