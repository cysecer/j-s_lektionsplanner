import type { Page } from "@playwright/test";
import sharp from "sharp";
import { expect, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";

async function signInAs(page: Page, role: "COACH" | "READER", name: string) {
  await acceptInvitation(page, invite(uniqueEmail(role.toLowerCase()), role), name);
  await page.getByRole("button", { name: "Später" }).click();
}

async function confirm(page: Page, name: string) {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name }).click();
  await expect(dialog).toBeHidden();
}

test("coach creates, edits, duplicates and deletes a program block", async ({ page }) => {
  await signInAs(page, "COACH", "Bea Block");
  await page.goto("/blocks");
  await page.getByRole("link", { name: "Neuer Programmblock" }).first().click();
  await expect(page).toHaveURL(/\/blocks\/new$/);

  // Server-side validation shows up next to the field.
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Pflichtfeld.").first()).toBeVisible();
  // A rejected save always says so, even for fields the form does not show.
  await expect(page.getByText("Bitte prüfe deine Eingaben.")).toBeVisible();

  await page.getByLabel("Name des Spiels / der Übung").fill("Schwänzchenfangen");
  await page.getByLabel("Dauer (Minuten)").fill("15");
  await page.getByLabel("Alter von").fill("6");
  await page.getByLabel("Alter bis").fill("10");
  await page.getByLabel("Anzahl Teams").fill("2");
  await page.getByLabel("Mindestanzahl Kinder").fill("16");
  await page.getByLabel("Max. Anzahl Kinder").fill("6");
  // Responsible persons are assigned per lesson, not on the block.
  await expect(page.getByText("Verantwortlich")).toHaveCount(0);

  const description = page.getByRole("textbox", { name: "Erklärung" });
  await description.click();
  await page.keyboard.type("Alle stecken ein ");
  await page.getByRole("button", { name: "Fett" }).first().click();
  await page.keyboard.type("Band");
  await page.getByRole("button", { name: "Fett" }).first().click();
  await page.keyboard.type(" hinten in die Hose.");

  const variations = page.getByRole("group", { name: "Variationen" });
  await variations.getByPlaceholder("Neuer Eintrag").fill("Paarweise an der Hand");
  await variations.getByPlaceholder("Neuer Eintrag").press("Enter");
  const material = page.getByRole("group", { name: "Material" });
  await material.getByPlaceholder("Neuer Eintrag").fill("Spielbänder");
  await material.getByPlaceholder("Neuer Eintrag").press("Enter");

  const sketch = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .png()
    .toBuffer();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "skizze.png",
    mimeType: "image/png",
    buffer: sketch,
  });
  await expect(page.getByRole("img", { name: /Skizze 1 zu «Schwänzchenfangen»/ })).toBeVisible();

  await page.getByRole("checkbox", { name: "Fangspiel" }).check();
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Die Mindestanzahl darf nicht höher sein als die Höchstanzahl." }),
  ).toBeVisible();
  await page.getByLabel("Mindestanzahl Kinder").fill("6");
  await page.getByLabel("Max. Anzahl Kinder").fill("16");
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page).toHaveURL(/\/blocks\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Schwänzchenfangen", level: 1 })).toBeVisible();
  await expect(page.locator("strong", { hasText: "Band" })).toBeVisible();
  await expect(page.getByText("Paarweise an der Hand")).toBeVisible();
  await expect(page.getByText("6–10 Jahre")).toBeVisible();
  await expect(page.getByText("15 Minuten")).toBeVisible();
  await expect(page.getByText("2 Teams")).toBeVisible();
  await expect(page.getByText("6–16 Kinder")).toBeVisible();
  await expect(
    page.getByText("Dieser Programmblock wurde noch in keiner Lektion verwendet."),
  ).toBeVisible();

  // Edit: an out-of-range value says exactly what is wrong, both in the
  // notification and at the field, and the cursor jumps to that field.
  await page.getByRole("link", { name: "Bearbeiten" }).click();
  const max = page.getByLabel("Max. Anzahl Kinder");
  await max.fill("999");
  await page.getByRole("button", { name: "Speichern" }).click();
  const toast = page
    .getByRole("listitem")
    .filter({ hasText: "Max. Anzahl Kinder: Bitte höchstens 500 eingeben." });
  await expect(toast).toContainText("Bitte prüfe deine Eingaben.");
  await expect(
    page.getByRole("alert").filter({ hasText: "Bitte höchstens 500 eingeben." }),
  ).toBeVisible();
  await expect(max).toBeFocused();
  await max.fill("16");
  await page.getByLabel("Dauer (Minuten)").fill("20");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("20 Minuten")).toBeVisible();

  // Duplicate opens the copy in the editor
  await page.getByRole("button", { name: "Duplizieren" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByLabel("Name des Spiels / der Übung")).toHaveValue(
    "Schwänzchenfangen (Kopie)",
  );
  await page.getByRole("link", { name: "Abbrechen" }).click();

  await page.getByRole("button", { name: "Löschen" }).click();
  await confirm(page, "Löschen");
  await expect(page).toHaveURL(/\/blocks$/);
  await page.goto("/blocks?q=Schwänzchenfangen");
  await expect(page.getByText("1 Programmblock")).toBeVisible(); // only the original remains
});

test("search, filters and robust URL parameters", async ({ page }) => {
  await signInAs(page, "COACH", "Sven Sucher");

  await page.goto("/blocks");
  await page.getByRole("searchbox", { name: "Programmblöcke durchsuchen" }).fill("ball");
  await page.getByRole("button", { name: "Suchen" }).click();
  // Substring search: "ball" finds "Keulenfussball" and "Heigositzball".
  await expect(page.getByRole("link", { name: /Keulenfussball/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Heigositzball/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Appell/ })).toHaveCount(0);

  // German stemming: "Fussbälle" finds the football games.
  await page.goto("/blocks?q=Fussb%C3%A4lle");
  await expect(page.getByText("2 Programmblöcke")).toBeVisible();

  // Filters via the form
  await page.goto("/blocks");
  await page.getByText("Filter", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Fussball" }).check();
  await page.getByRole("button", { name: "Anwenden" }).click();
  await expect(page).toHaveURL(/tags=/);
  await expect(page.getByText("2 Programmblöcke")).toBeVisible();

  await page.goto("/blocks?durMax=10&team=all");
  await expect(page.getByRole("link", { name: /^Appell/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Keulenfussball/ })).toHaveCount(0);

  // Group size: 24 kids rules out Mattenfussball (max. 20), not Keulenfussball (min. 6).
  await page.goto("/blocks?kids=24&team=all");
  await expect(page.getByRole("link", { name: /Keulenfussball/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mattenfussball/ })).toHaveCount(0);
  // Exact team count: of the demo games only Dschungelspiel is played in 2 teams.
  await page.goto("/blocks?teamCount=2&team=all");
  await expect(page.getByRole("link", { name: /Dschungelspiel/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Keulenfussball/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Mattenfussball/ })).toHaveCount(0);
  // Filtering by responsible coach no longer exists; the parameter is ignored.
  await page.goto("/blocks?coach=00000000-0000-4000-8000-000000000000&team=all");
  await expect(page.getByRole("link", { name: /Keulenfussball/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mattenfussball/ })).toBeVisible();

  // Invalid parameters are ignored, never an error page.
  const response = await page.goto(
    "/blocks?durMax=abc&sort=random()&tags=1;DROP&page=-3&team=../x&q=" + "x".repeat(300),
  );
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Programmblöcke", level: 1 })).toBeVisible();

  // Malformed ids on detail pages are a 404.
  expect((await page.goto("/blocks/not-a-uuid"))?.status()).toBe(404);
  expect((await page.goto("/blocks/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404);
});

test("readers can browse but not edit", async ({ page }) => {
  await signInAs(page, "READER", "Rita Reader");
  await page.goto("/blocks");
  await expect(page.getByRole("link", { name: "Neuer Programmblock" })).toHaveCount(0);
  await page.getByRole("link", { name: /Keulenfussball/ }).click();
  await expect(page.getByRole("heading", { name: "Keulenfussball", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bearbeiten" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Löschen" })).toHaveCount(0);
  await page.goto("/blocks/new");
  await expect(page).toHaveURL(/\/forbidden$/);
});

test("user content is shown as text, never as markup", async ({ page }) => {
  await signInAs(page, "COACH", "Xaver Xss");
  await page.goto("/blocks/new");
  const evil = '<img src=x onerror="window.__pwned=1">Spiel';
  await page.getByLabel("Name des Spiels / der Übung").fill(evil);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("heading", { name: evil, level: 1 })).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
  ).toBeUndefined();
});
