import "server-only";
import { parseEnv } from "./env-schema";

/**
 * Server environment, validated once at first import. A missing or malformed
 * variable fails fast with a readable message instead of surfacing later as
 * an obscure runtime error.
 */
export const env = parseEnv(process.env);
