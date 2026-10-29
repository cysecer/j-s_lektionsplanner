import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, newDevice, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";
import { overlappingText, readPdf } from "./pdf-helpers";

async function pdfPages(pdf: Uint8Array): Promise<string[]> {
  const pages = await readPdf(pdf);
  // Text drawn over other text means the layout broke at a page break.
  for (const [i, page] of pages.entries())
    expect(overlappingText(page), `page ${i + 1}`).toEqual([]);
  return pages.map((p) => p.text);
}

async function signIn(page: Page, role: "ADMIN" | "COACH" | "READER", name: string) {
  await acceptInvitation(page, invite(uniqueEmail(role.toLowerCase()), role), name);
  await page.getByRole("button", { name: "Später" }).click();
}

async function openSampleLesson(page: Page) {
  await page.goto("/lessons?team=all");
  await page.getByRole("link", { name: /28\.11\.2018/ }).click();
  await page.waitForURL(/\/lessons\/[0-9a-f-]{36}$/);
}

async function downloadPdf(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF herunterladen" }).click();
  const file = await download;
  return {
    name: file.suggestedFilename(),
    pages: await pdfPages(await readFile(await file.path())),
  };
}

test("coaches download the lesson as PDF with footer and page numbers", async ({ page }) => {
  await signIn(page, "COACH", "Petra PDF");
  await openSampleLesson(page);
  const { name, pages } = await downloadPdf(page);

  expect(name).toBe("2018-11-28_Lektionsvorbereitung_Kids_Spiele.pdf");
  const all = pages.join("\n");
  expect(all).toContain("Lektionstitel");
  expect(all).toContain("Dschungelspiel (eine Art Keulenstehlen)");
  expect(all).toContain("Heigositzball");
  // Footer on every page: club text and "Seite x von y".
  for (const [i, text] of pages.entries()) {
    expect(text).toContain("J+S-Kindersport");
    expect(text).toContain(`Seite ${i + 1} von ${pages.length}`);
  }
  // Nothing of the app around it.
  expect(all).not.toContain("PDF herunterladen");
  expect(all).not.toContain("Programmblöcke");
});

test("readers have a daily PDF limit set by the admin", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const adminDevice = await newDevice(browser);
  const admin = await adminDevice.newPage();
  await signIn(admin, "ADMIN", "Anna Admin");
  await admin.goto("/settings/club");
  const limit = admin.getByLabel("PDFs pro Tag für Lesende");
  await expect(limit).toHaveValue("10");
  await limit.fill("");
  await admin.getByRole("button", { name: "Speichern" }).click();
  await expect(admin.getByRole("alert").first()).toBeVisible();
  await limit.fill("1");
  await admin.getByRole("button", { name: "Speichern" }).click();
  await expect(admin.getByText("Gespeichert.")).toBeVisible();

  try {
    await signIn(page, "READER", "Rea Reader");
    await openSampleLesson(page);
    await expect(page.getByText("Heute noch 1 PDF")).toBeVisible();
    const { name } = await downloadPdf(page);
    expect(name).toMatch(/\.pdf$/);
    await expect(page.getByText("Heute keine PDFs mehr")).toBeVisible();
    await expect(page.getByRole("button", { name: "PDF herunterladen" })).toBeDisabled();

    // The limit holds on the server too, not only in the UI.
    const lessonId = page.url().split("/").at(-1)!;
    const response = await page.request.get(`/api/lessons/${lessonId}/pdf`);
    expect(response.status()).toBe(429);
    expect(await response.json()).toMatchObject({ error: "rateLimited", code: "pdfQuota" });
  } finally {
    await limit.fill("10");
    await admin.getByRole("button", { name: "Speichern" }).click();
    await expect(admin.getByText("Gespeichert.").first()).toBeVisible();
    await adminDevice.close();
  }
});

test("PDFs and the print page are not reachable without access", async ({ page, browser }) => {
  await signIn(page, "COACH", "Theo Token");
  await openSampleLesson(page);
  const lessonId = page.url().split("/").at(-1)!;

  const anonymous = await newDevice(browser);
  // Without a session the request never reaches the PDF route: off to the login.
  const response = await anonymous.request.get(`/api/lessons/${lessonId}/pdf`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/login?next=");
  expect(response.headers()["content-type"] ?? "").not.toContain("pdf");
  for (const token of ["", "abc", "a.b", "x".repeat(3000)]) {
    const print = await anonymous.request.get(
      `/print/lessons/${lessonId}?token=${encodeURIComponent(token)}`,
      { maxRedirects: 0 },
    );
    expect(print.status(), `token ${token.slice(0, 10)}`).toBe(404);
  }
  await anonymous.close();

  // Invalid parameters are rejected.
  expect((await page.request.get(`/api/lessons/not-a-uuid/pdf`)).status()).toBe(404);
  expect((await page.request.get(`/api/lessons/${lessonId}/pdf?layout=x`)).status()).toBe(400);
  expect((await page.request.get(`/api/lessons/${lessonId}/pdf?evil=1`)).status()).toBe(400);
});
