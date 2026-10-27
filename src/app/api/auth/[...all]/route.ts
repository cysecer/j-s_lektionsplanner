// Better Auth endpoints. Allowlisted in enforcement.test.ts: every endpoint
// validates its body with zod internally; custom endpoints (invitation
// plugin) declare strict zod schemas.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
