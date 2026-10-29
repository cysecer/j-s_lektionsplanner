import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";

async function signInAdmin(page: Page) {
  await acceptInvitation(page, invite(uniqueEmail("layout"), "ADMIN"), "Lara Layout");
  await page.getByRole("button", { name: "Später" }).click();
}

const preview = (page: Page) => page.getByRole("region", { name: "Vorschau" });
const column = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true }).filter({ has: page.getByText("Breite") });

async function drag(page: Page, from: Locator, to: Locator) {
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

test("build a layout: columns, fields, header; preview and lessons use it", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await signInAdmin(page);
  await page.goto("/settings/layout");
  await expect(page.getByText("Standard", { exact: true }).first()).toBeVisible();

  // Names must be unique.
  await page.getByLabel("Name für neues Layout").fill("kompakt");
  await page.getByRole("button", { name: "Layout erstellen" }).click();
  await expect(page.getByText("Dieser Name ist schon vergeben.").first()).toBeVisible();

  await page.getByLabel("Name für neues Layout").fill("Turnier");
  await page.getByRole("button", { name: "Layout erstellen" }).click();
  await page.waitForURL(/\/settings\/layout\/[0-9a-f-]{36}$/);
  await expect(preview(page).getByRole("columnheader", { name: "Material" }).first()).toBeVisible();

  // Rename a column; the preview follows live.
  await page.getByLabel("Spalte 2", { exact: true }).fill("Spiel");
  await expect(preview(page).getByRole("columnheader", { name: "Spiel" }).first()).toBeVisible();

  // Remove the material column: its field becomes "not shown".
  await page.getByRole("button", { name: "Material: Spalte entfernen" }).click();
  await expect(preview(page).getByRole("columnheader", { name: "Material" })).toHaveCount(0);
  const hidden = page.getByRole("region", { name: "Nicht angezeigt" });
  await expect(hidden.getByRole("listitem", { name: "Material" })).toBeVisible();

  // Keyboard/touch alternative: choose where a field goes.
  await page.getByLabel("Anzahl Teams: Verschieben nach").selectOption({ label: "→ Spiel" });
  await expect(column(page, "Spiel").getByRole("listitem", { name: "Anzahl Teams" })).toBeVisible();
  await column(page, "Spiel")
    .getByRole("listitem", { name: "Anzahl Teams" })
    .getByLabel("Beschriftung zeigen")
    .check();

  // Mouse drag: Regeln from the topic column into the neighbouring column.
  const durationColumn = column(page, "Dauer");
  await drag(
    page,
    column(page, "Spiel").getByRole("button", { name: "«Regeln» verschieben" }),
    durationColumn.getByRole("listitem", { name: "Dauer" }),
  );
  await expect(durationColumn.getByRole("listitem", { name: "Regeln" })).toBeVisible();
  await expect(column(page, "Spiel").getByRole("listitem", { name: "Regeln" })).toHaveCount(0);

  // Header: no safety row, larger text.
  await page.getByRole("checkbox", { name: "Sicherheitsaspekte" }).uncheck();
  await expect(preview(page).getByText("Sicherheitsaspekte:")).toHaveCount(0);
  await page.getByLabel("Schriftgrösse").selectOption("medium");

  // A column needs a heading.
  await page.getByLabel("Spalte 2", { exact: true }).fill("");
  await page.getByLabel("Spalte 2", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("alert").getByText(/Spalte 2/)).toBeVisible();
  await page.getByLabel("Spalte 2", { exact: true }).fill("Spiel");

  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Layout gespeichert.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Spalte 2", { exact: true })).toHaveValue("Spiel");
  await expect(durationColumn.getByRole("listitem", { name: "Regeln" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Sicherheitsaspekte" })).not.toBeChecked();

  // Any lesson can be viewed in it without changing the lesson.
  await page.goto("/lessons?team=all");
  await page.getByRole("link", { name: /28\.11\.2018/ }).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);
  await page
    .getByLabel("Dschungelspiel (eine Art Keulenstehlen): Verantwortlich")
    .selectOption({ label: "Marco Steiner" });
  await page.getByRole("button", { name: "Vorschau" }).click();
  await page.waitForURL(/\/preview$/);
  const doc = page.locator("article.lesson-document");
  await expect(doc.getByRole("columnheader", { name: "Material" }).first()).toBeVisible();
  // Standard layout: the responsible person heads the Organisation column.
  const organisationCell = doc.locator("tr", { hasText: "Dschungelspiel" }).locator("td").nth(2);
  await expect(organisationCell.locator("> div > div").first()).toHaveText(
    "Verantwortlich: Marco Steiner",
  );
  await page.getByRole("combobox", { name: "Layout" }).selectOption({ label: "Turnier" });
  await expect(page).toHaveURL(/\?layout=/);
  await expect(doc.getByRole("columnheader", { name: "Spiel" }).first()).toBeVisible();
  await expect(doc.getByRole("columnheader", { name: "Material" })).toHaveCount(0);
  await expect(doc.getByText("Anzahl Teams: 2 Teams")).toBeVisible();

  // Default layout: can't delete it; switch default and back.
  await page.goto("/settings/layout");
  await page.getByRole("button", { name: "Turnier: Als Standard" }).click();
  await expect(page.getByText("«Turnier» ist jetzt das Standard-Layout.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turnier: Löschen" })).toHaveCount(0);
  await page.getByRole("button", { name: "Standard: Als Standard" }).click();
  await expect(page.getByText("«Standard» ist jetzt das Standard-Layout.")).toBeVisible();

  // Duplicate and delete.
  await page.getByRole("button", { name: "Turnier: Duplizieren" }).click();
  await page.waitForURL(/\/settings\/layout\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Name des Layouts")).toHaveValue("Turnier (Kopie)");
  await page.goto("/settings/layout");
  await page.getByRole("button", { name: "Turnier (Kopie): Löschen" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
  await expect(page.getByText("Turnier (Kopie)")).toHaveCount(0);
});

test("readers see the lesson as a document; layouts are admin-only", async ({ page }) => {
  await acceptInvitation(page, invite(uniqueEmail("reader"), "READER"), "Rolf Reader");
  await page.getByRole("button", { name: "Später" }).click();
  await page.goto("/lessons?team=all");
  await page.getByRole("link", { name: /28\.11\.2018/ }).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);
  const doc = page.locator("article.lesson-document");
  await expect(doc.getByText("Rahmenbedingungen")).toBeVisible();
  await expect(doc.getByRole("columnheader", { name: "Thema/Übung/Spielform" })).toHaveCount(3);
  await expect(doc.getByText("Dschungelspiel (eine Art Keulenstehlen)")).toBeVisible();
  // Bogus ?layout= is ignored, not an error.
  await page.goto(`${page.url()}?layout=not-a-uuid`);
  await expect(doc.getByText("Rahmenbedingungen")).toBeVisible();

  await page.goto("/settings/layout");
  await expect(page).toHaveURL(/\/forbidden$/);
});
