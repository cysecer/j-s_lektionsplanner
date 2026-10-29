import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LocalStorage } from "./storage";

const club = "0192f0c1-7a3b-7c4d-8e5f-0123456789ab";
const asset = "0192f0c1-7a3b-7c4d-8e5f-0123456789ac";

describe("LocalStorage", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "lp-storage-"));
  const storage = new LocalStorage(root);
  afterAll(() => rm(root, { recursive: true, force: true }));

  it("stores, reads and deletes by key", async () => {
    const key = `${club}/${asset}.png`;
    await storage.put(key, Buffer.from("x"));
    expect((await storage.get(key))?.toString()).toBe("x");
    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it("never overwrites an existing asset", async () => {
    const key = `${club}/${asset}.jpg`;
    await storage.put(key, Buffer.from("a"));
    await expect(storage.put(key, Buffer.from("b"))).rejects.toThrow();
  });

  it.each([
    "../etc/passwd",
    `${club}/../../secret.png`,
    `${club}/${asset}.svg`,
    `${club}/${asset}.png/../x.png`,
    "/absolute/path.png",
    `${club}\\${asset}.png`,
  ])("rejects key %j", async (key) => {
    await expect(storage.get(key)).rejects.toThrow("Invalid storage key");
    await expect(storage.put(key, Buffer.from("x"))).rejects.toThrow("Invalid storage key");
  });
});
