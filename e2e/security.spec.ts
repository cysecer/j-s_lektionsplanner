import { expect, test } from "./fixtures";

test("every response carries security headers and a per-request CSP nonce", async ({
  page,
  request,
}) => {
  const first = await request.get("/login");
  const second = await request.get("/login");
  const csp = first.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("unsafe-eval");
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  expect(second.headers()["content-security-policy"]).not.toContain(nonce!);

  expect(first.headers()).toMatchObject({
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  expect(first.headers()["permissions-policy"]).toContain("camera=()");

  // Redirects to the login page carry them too.
  const redirect = await request.get("/lessons", { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers()["content-security-policy"]).toContain("default-src 'self'");

  // Next.js tags its scripts with the nonce, so the page works under the policy.
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Mit Passkey anmelden" })).toBeVisible();
  const scripts = await page
    .locator("script[src]")
    .evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).nonce ?? ""));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((n) => n.length > 0)).toBe(true);
});
