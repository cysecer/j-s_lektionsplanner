import type { Browser } from "@playwright/test";
import { expect, newDevice, test } from "./fixtures";
import { acceptInvitation, invite, signInWithMagicLink, signOut, uniqueEmail } from "./helpers";

async function twoDevices(browser: Browser, name: string) {
  const email = uniqueEmail("devices");
  const deviceA = await newDevice(browser);
  const pageA = await deviceA.newPage();
  await acceptInvitation(pageA, invite(email), name);

  const deviceB = await newDevice(browser);
  const pageB = await deviceB.newPage();
  await signInWithMagicLink(pageB, email);
  await expect(pageB.getByText(`Angemeldet als ${name}`)).toBeVisible();
  return { pageA, pageB, close: () => Promise.all([deviceA.close(), deviceB.close()]) };
}

test("sign out everywhere ends the sessions on all devices", async ({ browser }) => {
  const { pageA, pageB, close } = await twoDevices(browser, "Sandro Test");

  await pageA.goto("/account");
  await pageA.getByRole("button", { name: "Auf allen Geräten abmelden" }).click();
  await pageA.waitForURL("**/login");
  // The old session cookie no longer opens anything on device A…
  await pageA.goto("/account");
  await expect(pageA).toHaveURL(/\/login/);
  // …and device B is signed out as well.
  await pageB.goto("/account");
  await expect(pageB).toHaveURL(/\/login/);

  await close();
});

test("signing out on one device keeps the other signed in", async ({ browser }) => {
  const { pageA, pageB, close } = await twoDevices(browser, "Lea Test");

  await pageA.goto("/");
  await signOut(pageA);
  await pageB.goto("/account");
  await expect(pageB).toHaveURL(/\/account$/);
  await expect(pageB.getByRole("heading", { name: "Mein Konto" })).toBeVisible();

  await close();
});
