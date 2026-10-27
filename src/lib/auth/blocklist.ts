import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

let cached: Promise<ReadonlySet<string>> | null = null;

/** Known breached passwords (see data/README.md), loaded once on first use. */
export function getPasswordBlocklist(): Promise<ReadonlySet<string>> {
  cached ??= readFile(path.join(process.cwd(), "data", "common-passwords.txt"), "utf8").then(
    (content) => new Set(content.split("\n").filter(Boolean)),
  );
  return cached;
}
