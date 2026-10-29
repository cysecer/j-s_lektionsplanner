import { Client } from "pg";
import sharp from "sharp";
import { e2eDatabaseUrl } from "./env";
import { expect, test } from "./fixtures";
import { acceptInvitation, invite, uniqueEmail } from "./helpers";

test("uploads never attached to anything are removed after a day", async ({ page }) => {
  await acceptInvitation(page, invite(uniqueEmail("coach"), "COACH"), "Uli Upload");
  await page.getByRole("button", { name: "Später" }).click();

  const png = (color: number) =>
    sharp({ create: { width: 12, height: 12, channels: 3, background: { r: color, g: 0, b: 0 } } })
      .png()
      .toBuffer();
  const upload = async (color: number) => {
    const response = await page.request.post("/api/uploads?purpose=sketch", {
      multipart: { file: { name: "skizze.png", mimeType: "image/png", buffer: await png(color) } },
    });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };

  const abandoned = await upload(10);
  const recent = await upload(20);
  expect((await page.request.get(`/api/assets/${abandoned}`)).status()).toBe(200);

  // Pretend the first upload is two days old.
  const db = new Client({ connectionString: e2eDatabaseUrl() });
  await db.connect();
  try {
    await db.query(`UPDATE "Asset" SET "createdAt" = now() - interval '2 days' WHERE id = $1`, [
      abandoned,
    ]);
  } finally {
    await db.end();
  }

  // The next upload sweeps it away; the fresh one stays.
  await upload(30);
  expect((await page.request.get(`/api/assets/${abandoned}`)).status()).toBe(404);
  expect((await page.request.get(`/api/assets/${recent}`)).status()).toBe(200);
});
