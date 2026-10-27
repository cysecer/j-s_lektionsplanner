import { expect, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";

test("language is switchable before login and remembered per user", async ({ page, browser }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sprache" }).click();
  await page.getByRole("menuitemradio", { name: "Français" }).click();
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr-CH");

  // Signed in: the choice is stored on the account…
  const email = uniqueEmail("lang");
  await acceptInvitation(page, invite(email), "Julien Test", {
    nameLabel: "Ton nom",
    accept: "Accepter l'invitation",
  });
  await page.getByRole("button", { name: "Plus tard" }).click();
  await page.getByRole("button", { name: "Langue" }).click();
  await page.getByRole("menuitemradio", { name: "Italiano" }).click();
  await expect(page.getByRole("heading", { name: "Lezioni" })).toBeVisible();

  // …so another device (fresh cookies, German browser) follows it after login.
  const other = await browser.newContext({ locale: "de-CH" });
  const otherPage = await other.newPage();
  await otherPage.context().addCookies(await page.context().cookies());
  await otherPage.context().clearCookies({ name: "NEXT_LOCALE" });
  await otherPage.goto("/lessons");
  await expect(otherPage.getByRole("heading", { name: "Lezioni" })).toBeVisible();
  await other.close();
});

test("all five languages render the main navigation", async ({ page }) => {
  await acceptInvitation(page, invite(uniqueEmail("langs"), "ADMIN"), "Patrick Test");
  await page.getByRole("button", { name: "Später" }).click();

  const expected = [
    ["Deutsch", "Lektionen", "Programmblöcke", "Einstellungen"],
    ["Français", "Leçons", "Blocs de programme", "Paramètres"],
    ["Italiano", "Lezioni", "Blocchi di programma", "Impostazioni"],
    ["Rumantsch", "Lecziuns", "Blocs da program", "Configuraziun"],
    ["English", "Lessons", "Program blocks", "Settings"],
  ] as const;

  for (const [language, ...links] of expected) {
    await page.getByRole("button", { name: /^(Sprache|Langue|Lingua|Language)$/ }).click();
    await page.getByRole("menuitemradio", { name: language }).click();
    const nav = page.getByRole("navigation").first();
    for (const link of links) await expect(nav.getByRole("link", { name: link })).toBeVisible();
  }
});

test("team filter is saved and settings are admin-only", async ({ page }) => {
  await acceptInvitation(page, invite(uniqueEmail("team"), "READER"), "Lea Leserin");
  await page.getByRole("button", { name: "Später" }).click();

  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await expect(nav.getByRole("link", { name: "Lektionen" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/forbidden$/);

  await page.goto("/lessons");
  await page.getByRole("combobox", { name: "Riege" }).click();
  const saved = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined,
  );
  await page.getByRole("option", { name: "TuVo" }).click();
  await saved;
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Riege" })).toHaveText(/TuVo/);
});

test("mobile: navigation lives in a menu panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await acceptInvitation(page, invite(uniqueEmail("mobile")), "Mia Mobil");
  await page.getByRole("button", { name: "Später" }).click();

  await page.getByRole("button", { name: "Menü öffnen" }).click();
  const panel = page.getByRole("dialog", { name: "Menü" });
  await panel.getByRole("link", { name: "Programmblöcke" }).click();
  await expect(page).toHaveURL(/\/blocks$/);
  await expect(page.getByRole("heading", { name: "Programmblöcke" })).toBeVisible();
});
