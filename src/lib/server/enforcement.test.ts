/**
 * Architecture guard: no interface without validation.
 * Scans the source tree and fails if a server action, route handler or page
 * input bypasses the validating wrappers.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");

/** Route handlers that validate on their own (Better Auth uses zod schemas internally). */
const ROUTE_ALLOWLIST = new Set(["app/api/auth/[...all]/route.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "generated" || name === "node_modules") return [];
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function hasTopLevelUseServer(code: string) {
  return /^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*["']use server["']/.test(code);
}

function checkActionModule(code: string): string[] {
  const problems: string[] = [];
  if (/export\s+(default|async\s+function|function)\b/.test(code)) {
    problems.push("exports a plain function; wrap it with action()");
  }
  for (const match of code.matchAll(/export\s+(?:const|let|var)\s+(\w+)\s*=\s*([^\n]*)/g)) {
    if (!/^action\(/.test(match[2]!.trim())) problems.push(`export ${match[1]} is not action()`);
  }
  if (/export\s*\{/.test(code) || /export\s*\*/.test(code))
    problems.push("re-exports are not allowed");
  return problems;
}

function checkInlineServerAction(code: string): boolean {
  return !hasTopLevelUseServer(code) && /["']use server["']/.test(code);
}

function checkRouteModule(code: string): string[] {
  const problems: string[] = [];
  for (const match of code.matchAll(
    /export\s+(?:const|let|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b\s*=?\s*([^\n]*)/g,
  )) {
    if (!/^route\(/.test(match[2]!.trim())) problems.push(`${match[1]} bypasses route()`);
  }
  if (/export\s*\{[^}]*\b(GET|POST|PUT|PATCH|DELETE)\b/.test(code))
    problems.push("re-exported handler");
  if (/export\s+(?:const|let)\s*\{/.test(code)) problems.push("destructured handler export");
  return problems;
}

function checkPageModule(code: string): boolean {
  const usesInput = /\b(params|searchParams)\b/.test(
    code.replace(/(Layout|Page)Props<[^>]*>/g, ""),
  );
  return !usesInput || code.includes("parsePageInput(");
}

describe("enforcement rules detect violations", () => {
  it("flags plain exports in action modules", () => {
    expect(checkActionModule(`"use server";\nexport async function save(x) {}`)).not.toEqual([]);
    expect(checkActionModule(`"use server";\nexport const save = async (x) => {}`)).not.toEqual([]);
    expect(checkActionModule(`"use server";\nexport { save } from "./x";`)).not.toEqual([]);
    expect(checkActionModule(`"use server";\nexport default async function () {}`)).not.toEqual([]);
    expect(
      checkActionModule(
        `"use server";\nexport const save = action({ input, role: "COACH", handler });`,
      ),
    ).toEqual([]);
  });

  it("flags inline server actions", () => {
    expect(checkInlineServerAction(`function C() { async function a() { "use server"; } }`)).toBe(
      true,
    );
    expect(checkInlineServerAction(`// header\n"use server";\nexport const a = action({})`)).toBe(
      false,
    );
  });

  it("flags route handlers without route()", () => {
    expect(checkRouteModule(`export async function GET(req) {}`)).not.toEqual([]);
    expect(checkRouteModule(`export const POST = async (req) => {}`)).not.toEqual([]);
    expect(checkRouteModule(`export { GET } from "./x"`)).not.toEqual([]);
    expect(checkRouteModule(`export const { GET, POST } = handler(x);`)).not.toEqual([]);
    expect(checkRouteModule(`export const GET = route({ role: "READER", handler });`)).toEqual([]);
  });

  it("flags pages reading params without validation", () => {
    expect(checkPageModule(`export default async function P({ params }) {}`)).toBe(false);
    expect(checkPageModule(`const { id } = await parsePageInput(schema, params);`)).toBe(true);
    expect(checkPageModule(`export default function P() { return null }`)).toBe(true);
  });
});

describe("source tree follows the rules", () => {
  const files = walk(SRC)
    .filter((f) => !/\.test\.tsx?$/.test(f))
    .map((f) => ({
      rel: path.relative(SRC, f).replaceAll("\\", "/"),
      code: readFileSync(f, "utf8"),
    }));

  it("found source files to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("server action modules export only action(...) wrappers", () => {
    const problems = files
      .filter((f) => hasTopLevelUseServer(f.code))
      .flatMap((f) => checkActionModule(f.code).map((p) => `${f.rel}: ${p}`));
    expect(problems).toEqual([]);
  });

  it("no inline server actions", () => {
    expect(files.filter((f) => checkInlineServerAction(f.code)).map((f) => f.rel)).toEqual([]);
  });

  it("route handlers use route(...)", () => {
    const problems = files
      .filter((f) => /(^|\/)route\.ts$/.test(f.rel) && !ROUTE_ALLOWLIST.has(f.rel))
      .flatMap((f) => checkRouteModule(f.code).map((p) => `${f.rel}: ${p}`));
    expect(problems).toEqual([]);
  });

  it("pages and layouts validate params and searchParams", () => {
    const offenders = files
      .filter((f) => /(^|\/)(page|layout)\.tsx$/.test(f.rel) && !checkPageModule(f.code))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});
