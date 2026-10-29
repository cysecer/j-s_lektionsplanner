import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";
import { overlappingText, readPdf } from "./pdf-helpers";

async function pdfPages(pdf: Uint8Array): Promise<string[]> {
  const pages = await readPdf(pdf);
  // Text drawn over other text means the layout broke at a page break.
  for (const [i, page] of pages.entries())
    expect(overlappingText(page), `page ${i + 1}`).toEqual([]);
  return pages.map((p) => p.text);
}

const count = (text: string, needle: string) => text.split(needle).length - 1;

async function longLesson(page: Page, copies: number) {
  await acceptInvitation(page, invite(uniqueEmail("print")), "Paula Print");
  await page.getByRole("button", { name: "Später" }).click();
  await page.goto("/lessons");
  await page.getByRole("button", { name: "Neue Lektionsvorbereitung" }).first().click();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  await page.getByLabel("Lektionstitel").fill("Viele Seiten");
  const panel = page.getByRole("complementary");
  await panel.getByRole("searchbox", { name: "Programmblöcke durchsuchen" }).fill("Dschungel");
  const add = panel.getByRole("button", { name: /«Dschungelspiel.*» hinzufügen/ });
  for (let i = 0; i < copies; i++) {
    await add.click();
    await expect(page.getByRole("region", { name: "Einleitung" }).locator("article")).toHaveCount(
      i + 1,
    );
  }
  await expect(page.getByText("Alle Änderungen gespeichert")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Vorschau" }).click();
  await expect(page).toHaveURL(/\/preview$/);
}

test("printed rows are never split across pages", async ({ page }) => {
  test.setTimeout(120_000);
  await longLesson(page, 12);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pages = await pdfPages(pdf);

  expect(pages.length).toBeGreaterThan(2);
  // Each game starts with its title and ends with its last variation.
  for (const [index, text] of pages.entries()) {
    expect(count(text, "Jeder Affe"), `page ${index + 1}`).toBe(count(text, "Dschungelspiel"));
  }
  expect(pages.reduce((sum, text) => sum + count(text, "Dschungelspiel"), 0)).toBe(12);
  // Column headings repeat on every page that continues a section.
  for (const text of pages.slice(1)) expect(text).toContain("Thema/Übung/Spielform");
  // No app chrome on paper.
  expect(pages[0]).not.toContain("Zurück zum Bearbeiten");
  expect(pages[0]).not.toContain("Programmblöcke");
});
