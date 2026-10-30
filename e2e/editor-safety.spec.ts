import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { acceptInvitation, createLesson, invite, uniqueEmail } from "./helpers";

async function signIn(page: Page, name: string) {
  await acceptInvitation(page, invite(uniqueEmail("coach"), "COACH"), name);
  await page.getByRole("button", { name: "Später" }).click();
}

const saved = (page: Page) =>
  expect(page.getByText("Alle Änderungen gespeichert")).toBeVisible({ timeout: 10_000 });

test("finished lessons save automatically, and leaving saves what is pending", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page, "Sina Sicher");
  await createLesson(page, `Sicher ${stamp}`);
  await saved(page);

  // Finished lessons autosave too.
  await page.getByRole("button", { name: "Fertigstellen" }).click();
  await expect(page.getByText("Lektion ist fertig.")).toBeVisible();
  await page.getByLabel("Lektionsdauer (Minuten)").fill("75");
  await saved(page);
  await page.reload();
  await expect(page.getByLabel("Lektionsdauer (Minuten)")).toHaveValue("75");

  // Leaving right after a change (before the autosave delay) still saves it.
  await page.getByLabel("Lektionstitel").fill(`Sofort weg ${stamp}`);
  await page.getByRole("link", { name: "Alle Lektionen" }).click();
  await page.waitForURL(/\/lessons$/);
  await expect(async () => {
    await page.goto(`/lessons?team=all&q=${stamp}`);
    await expect(page.getByRole("link", { name: new RegExp(`Sofort weg ${stamp}`) })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 10_000 });
});

test("a new lesson asks before leaving and survives a reload", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page, "Nils Neu");
  await page.goto("/lessons/new");
  await page.getByLabel("Lektionstitel").fill(`Ungespeichert ${stamp}`);

  // An in-app link asks first.
  await page.getByRole("link", { name: "Alle Lektionen" }).click();
  const leave = page.getByRole("alertdialog", { name: "Lektion noch nicht gespeichert" });
  await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "Weiter bearbeiten" }).click();
  await expect(page).toHaveURL(/\/lessons\/new$/);
  await expect(page.getByLabel("Lektionstitel")).toHaveValue(`Ungespeichert ${stamp}`);

  // A reload (the browser asks; confirmed here) keeps a copy in the browser.
  await page.waitForTimeout(600); // the copy is written shortly after typing
  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
  const banner = page
    .getByRole("status")
    .filter({ hasText: "Nicht gespeicherte Lektion gefunden" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(`Ungespeichert ${stamp}`);
  await banner.getByRole("button", { name: "Wiederherstellen" }).click();
  await expect(page.getByLabel("Lektionstitel")).toHaveValue(`Ungespeichert ${stamp}`);

  // Saving from the question stores it; the copy is gone afterwards.
  await page.getByRole("link", { name: "Alle Lektionen" }).click();
  await leave.getByRole("button", { name: "Entwurf speichern" }).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);
  await page.goto("/lessons/new");
  await expect(page.getByText("Nicht gespeicherte Lektion gefunden")).toHaveCount(0);
});

test("the program item dialog does not lose changes by accident", async ({ page }) => {
  await signIn(page, "Ida Item");
  await createLesson(page, `Dialog ${Date.now()}`);
  const intro = page.getByRole("region", { name: "Einleitung" });
  await intro.getByRole("button", { name: "Kurzen Punkt erfassen" }).click();
  await intro.getByLabel("Titel").fill("Begrüssung");
  await intro.getByLabel("Minuten").fill("5");
  await intro.getByRole("button", { name: "Kurzen Punkt erfassen" }).click();
  await saved(page);

  await page.getByRole("button", { name: "Begrüssung: Bearbeiten" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Dauer (Minuten)").fill("8");

  // A click beside the dialog does nothing.
  await page.mouse.click(5, 5);
  await expect(dialog.getByLabel("Dauer (Minuten)")).toHaveValue("8");

  // Escape asks; "Weiter bearbeiten" keeps the input.
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Änderungen übernehmen?")).toBeVisible();
  await dialog.getByRole("button", { name: "Weiter bearbeiten" }).click();
  await expect(dialog.getByLabel("Dauer (Minuten)")).toHaveValue("8");

  // Escape again, "Übernehmen": the change lands in the lesson.
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(dialog).toBeHidden();
  await expect(intro.getByText("8'").first()).toBeVisible();
});
