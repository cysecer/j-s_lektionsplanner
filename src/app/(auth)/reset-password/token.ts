import { z } from "zod";

/** Better Auth reset tokens are random alphanumeric strings. */
export const resetTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
