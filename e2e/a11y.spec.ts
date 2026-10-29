import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, newDevice, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";

/** WCAG 2.1 A and AA rules; prints what is wrong and where. */
async function audit(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const report = violations.map(
    (v) =>
      `${name}: ${v.id} (${v.impact}) – ${v.help}\n` +
      v.nodes
        .slice(0, 3)
        .map((n) => `    ${n.target.join(" ")}: ${n.failureSummary?.split("\n")[1] ?? ""}`)
        .join("\n"),
  );
  expect(report, report.join("\n")).toEqual([]);
}

test("main pages meet WCAG 2.1 AA (automated checks)", async ({ page, browser }) => {
  test.setTimeout(180_000);

  const visitor = await newDevice(browser);
  const login = await visitor.newPage();
  await login.goto("/login");
  await audit(login, "/login");
  await visitor.close();

  await acceptInvitation(page, invite(uniqueEmail("admin"), "ADMIN"), "Alba Zugang");
  await page.getByRole("button", { name: "Später" }).click();

  const pages = [
    "/lessons",
    "/lessons?team=all&when=past",
    "/lessons/new",
    "/blocks",
    "/blocks/new",
    "/settings/club",
    "/settings/teams",
    "/settings/people",
    "/settings/mail",
    "/settings/layout",
  ];
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await audit(page, path);
  }

  // The sample lesson in the editor and as document, and a block.
  await page.goto("/lessons?team=all&when=past");
  await page.getByRole("link", { name: /28\.11\.2018/ }).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);
  await audit(page, "lesson editor");
  await page.getByRole("button", { name: "Vorschau" }).click();
  await page.waitForURL(/\/preview$/);
  await audit(page, "lesson preview");

  await page.goto("/blocks");
  await page.getByRole("link", { name: "Keulenfussball" }).first().click();
  await page.waitForURL(/\/blocks\/[0-9a-f-]{36}$/);
  await audit(page, "block");
});
