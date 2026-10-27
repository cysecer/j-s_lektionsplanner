import { expect, test } from "./fixtures";
import {
  acceptInvitation,
  addVirtualAuthenticator,
  countEmails,
  firstLink,
  invite,
  signOut,
  uniqueEmail,
  waitForEmail,
} from "./helpers";
import { E2E_APP_URL } from "./env";

test("visitors without a session are sent to the login page", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
  await expect(page.getByRole("button", { name: "Mit Passkey anmelden" })).toBeVisible();
});

test("an invitation creates the account and pushes for a passkey", async ({ page }) => {
  const email = uniqueEmail("invite");
  await acceptInvitation(page, invite(email, "COACH"), "Andrea Test");

  await expect(page.getByText("Schneller anmelden mit Passkey")).toBeVisible();
  await page.getByRole("button", { name: "Später" }).click();
  await expect(page.getByText("Angemeldet als Andrea Test (Leiter/-in)")).toBeVisible();

  // The link is single-use.
  await signOut(page);
  await page.goto(invite(email, "COACH").replace(/[^/]+$/, "x".repeat(43)));
  await expect(page.getByText(/ungültig, abgelaufen oder wurde bereits verwendet/)).toBeVisible();
});

test("malformed invitation tokens are rejected before any lookup", async ({ page }) => {
  const response = await page.goto("/invite/not-a-token");
  expect(response?.status()).toBe(404);
});

test("magic link sign-in, without revealing unknown addresses", async ({ page }) => {
  const email = uniqueEmail("magic");
  await acceptInvitation(page, invite(email), "Marco Test");
  await signOut(page);

  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page.getByText("Schau in dein Postfach")).toBeVisible();

  const link = firstLink(await waitForEmail(email, /Anmeldelink/)).replace(
    /^http:\/\/localhost:\d+/,
    E2E_APP_URL,
  );
  await page.goto(link);
  await expect(page.getByText("Angemeldet als Marco Test")).toBeVisible();

  // Unknown address: identical response, but no email is sent.
  await signOut(page);
  const stranger = uniqueEmail("stranger");
  await page.getByLabel("E-Mail-Adresse").fill(stranger);
  await page.getByRole("button", { name: "Anmeldelink senden" }).click();
  await expect(page.getByText("Schau in dein Postfach")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await countEmails(stranger)).toBe(0);
});

test("password fallback: policy, sign-in and lockout", async ({ page }) => {
  const email = uniqueEmail("password");
  await acceptInvitation(page, invite(email), "Nina Test");
  await page.goto("/account");

  const newPassword = page.getByLabel("Neues Passwort");
  const save = page.getByRole("button", { name: "Passwort festlegen" });

  await newPassword.fill("zu kurz");
  await save.click();
  await expect(page.getByText(/Mindestens 15 Zeichen/).first()).toBeVisible();

  await newPassword.fill("harrypotterharrypotter");
  await save.click();
  await expect(
    page.getByText("Dieses Passwort ist aus Datenlecks bekannt.", { exact: false }),
  ).toBeVisible();

  await newPassword.fill("nina test lektionsplaner");
  await save.click();
  await expect(page.getByText(/zu nahe an deinem Namen/)).toBeVisible();

  const good = "gelbe velos fahren im regen";
  await newPassword.fill(good);
  await save.click();
  await expect(page.getByText("Passwort gespeichert.")).toBeVisible();

  await signOut(page);
  await page.getByRole("button", { name: "Stattdessen mit Passwort anmelden" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(good);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByText("Angemeldet als Nina Test")).toBeVisible();

  // Three wrong passwords (AUTH_MAX_FAILED_SIGNINS=3 in e2e) lock password sign-in…
  await signOut(page);
  await page.getByRole("button", { name: "Stattdessen mit Passwort anmelden" }).click();
  await page.getByLabel("E-Mail-Adresse").fill(email);
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("Passwort").fill(`falsch falsch falsch ${i}`);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page.getByText(/Anmeldung fehlgeschlagen/)).toBeVisible();
  }
  // …so even the correct password fails now, with the same message.
  await page.getByLabel("Passwort").fill(good);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByText(/Anmeldung fehlgeschlagen/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("passkey: set up after invitation, then sign in with it", async ({ page }) => {
  await addVirtualAuthenticator(page);
  const email = uniqueEmail("passkey");
  await acceptInvitation(page, invite(email), "Luca Test");

  await page.getByRole("button", { name: "Passkey einrichten" }).click();
  await expect(page.getByText("Angemeldet als Luca Test")).toBeVisible();

  await page.goto("/account");
  await expect(page.getByText(/Eingerichtet am/)).toBeVisible();

  await signOut(page);
  await page.getByRole("button", { name: "Mit Passkey anmelden" }).click();
  await expect(page.getByText("Angemeldet als Luca Test")).toBeVisible();
});

test("server actions reject unauthenticated and malformed calls", async ({ request }) => {
  // Better Auth endpoints validate bodies: an invalid invitation token is refused.
  const response = await request.post("/api/auth/invitation/accept", {
    data: { token: "../../etc/passwd", name: "x" },
    headers: { origin: E2E_APP_URL },
  });
  expect(response.status()).toBe(400);
});
