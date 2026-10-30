import sharp from "sharp";
import { expect, nextClientIp, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";

test("an invited person gets the language chosen in the invitation", async ({ browser }) => {
  // A browser that prefers English, and no language picked yet.
  const device = await browser.newContext({
    locale: "en-US",
    extraHTTPHeaders: { "x-forwarded-for": nextClientIp(), "accept-language": "en-US,en;q=0.9" },
  });
  const page = await device.newPage();
  try {
    const link = invite(uniqueEmail("francais"), "COACH", "fr-CH");
    await page.goto(link);
    await expect(
      page.getByRole("heading", { name: "Bienvenue dans le planificateur de leçons" }),
    ).toBeVisible();

    await acceptInvitation(page, link, "Fabienne Français", {
      nameLabel: "Ton nom",
      accept: "Accepter l'invitation",
    });
    await page.goto("/lessons");
    await expect(page.getByRole("link", { name: "Leçons" }).first()).toBeVisible();

    // Remembered for the login page as well.
    const cookies = await device.cookies();
    expect(cookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe("fr-CH");
  } finally {
    await device.close();
  }
});

test("admins set the favicon; it is shown on every page, also before sign-in", async ({
  page,
  browser,
}) => {
  await acceptInvitation(page, invite(uniqueEmail("admin"), "ADMIN"), "Fiona Favicon");
  await page.getByRole("button", { name: "Später" }).click();
  await page.goto("/settings/club");
  await expect(page.getByText("Noch kein eigenes Favicon")).toBeVisible();

  const square = await sharp({
    create: {
      width: 300,
      height: 200,
      channels: 4,
      background: { r: 200, g: 20, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[type="file"]')
    .nth(1)
    .setInputFiles({ name: "icon.png", mimeType: "image/png", buffer: square });
  await expect(page.getByRole("img", { name: "Favicon" })).toBeVisible();

  try {
    await page.reload();
    const href = await page.locator('link[rel="icon"][href*="/api/favicon"]').getAttribute("href");
    expect(href).toMatch(/^\/api\/favicon\?size=32&v=[0-9a-f-]{36}$/);
    await expect(page.locator('link[rel="apple-touch-icon"][href*="size=180"]')).toHaveCount(1);

    // Visitors without a session (login page) get it too, as a 32×32 PNG.
    const visitor = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": nextClientIp() },
    });
    const login = await visitor.newPage();
    await login.goto("/login");
    await expect(login.locator('link[rel="icon"][href*="/api/favicon"]')).toHaveCount(1);
    const response = await visitor.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const meta = await sharp(await response.body()).metadata();
    expect([meta.width, meta.height]).toEqual([32, 32]);
    expect((await visitor.request.get("/api/favicon?size=64")).status()).toBe(400);
    await visitor.close();
  } finally {
    await page.getByRole("button", { name: "Favicon entfernen" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Favicon entfernen" }).click();
    await expect(page.getByText("Noch kein eigenes Favicon")).toBeVisible();
  }
  await page.reload();
  await expect(page.locator('link[rel="icon"][href*="/api/favicon"]')).toHaveCount(0);
  expect((await page.request.get("/api/favicon?size=32")).status()).toBe(404);
});
