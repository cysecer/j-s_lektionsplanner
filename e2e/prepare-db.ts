/**
 * Recreates the dedicated end-to-end database (never the development one),
 * applies all migrations and loads the demo data.
 */
import { execSync } from "node:child_process";
import { Client } from "pg";
import { rmSync } from "node:fs";
import { E2E_DATABASE, E2E_STORAGE_DIR, e2eDatabaseUrl, adminDatabaseUrl } from "./env";

async function main() {
  const admin = new Client({ connectionString: adminDatabaseUrl() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${E2E_DATABASE}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${E2E_DATABASE}"`);
  await admin.end();

  rmSync(E2E_STORAGE_DIR, { recursive: true, force: true });

  const env = { ...process.env, DATABASE_URL: e2eDatabaseUrl() };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
