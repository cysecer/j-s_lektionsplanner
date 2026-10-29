import { z } from "zod";
import { Difficulty } from "@/generated/prisma/enums";

export const BLOCK_SORTS = ["relevance", "name", "duration", "lastUsed", "mostUsed"] as const;
export type BlockSort = (typeof BLOCK_SORTS)[number];
export const BLOCKS_PAGE_SIZE = 24;

/** Each parameter is validated on its own; an invalid one is ignored, never an error page. */
const loose = <S extends z.ZodType>(schema: S) => schema.optional().catch(undefined);

const intParam = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

/** URL search params of the block library (also used by the lesson editor's side panel). */
export const blockSearchSchema = z.object({
  q: loose(z.string().trim().min(1).max(100)),
  /** Comma-separated tag ids; a block must carry all of them. */
  tags: loose(
    z
      .string()
      .max(2000)
      .transform((s) => [...new Set(s.split(",").filter(Boolean))])
      .pipe(z.array(z.uuid()).min(1).max(30)),
  ),
  section: loose(z.uuid()),
  /** "all" = every team; absent = the team chosen in the header. */
  team: loose(z.union([z.literal("all"), z.uuid()])),
  durMin: loose(intParam(0, 600)),
  durMax: loose(intParam(0, 600)),
  difficulty: loose(z.enum(Difficulty)),
  age: loose(intParam(0, 120)),
  /** Group size: blocks whose min/max number of kids includes it. */
  kids: loose(intParam(1, 500)),
  /** Exact number of teams. */
  teamCount: loose(intParam(1, 50)),
  sort: loose(z.enum(BLOCK_SORTS)),
  page: loose(intParam(1, 10_000)),
});

export type BlockSearch = z.output<typeof blockSearchSchema>;

/**
 * Plain GET forms send repeated keys (tags=a&tags=b). Collapse them before
 * validation: tags are joined, any other repeated key keeps its first value.
 */
export async function normalizeSearchParams(
  raw: Promise<Record<string, string | string[] | undefined>>,
): Promise<Record<string, string | undefined>> {
  const entries = Object.entries(await raw)
    .map(([key, value]) => [
      key,
      Array.isArray(value) ? (key === "tags" ? value.join(",") : value[0]) : value,
    ])
    // Empty form fields mean "not set" (a blank number would otherwise coerce to 0).
    .filter(([, value]) => typeof value === "string" && value.trim() !== "");
  return Object.fromEntries(entries);
}

/** Builds a query string from search state, dropping empty values. */
export function blockSearchToQuery(search: Partial<Record<keyof BlockSearch, unknown>>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params.toString();
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
