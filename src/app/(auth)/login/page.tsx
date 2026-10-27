import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { safeRedirectPathSchema } from "@/lib/safe-redirect";
import { parsePageInput } from "@/lib/server/params";
import { LoginForm } from "./login-form";

const searchSchema = z.object({
  next: safeRedirectPathSchema.optional().catch(undefined),
  error: z
    .string()
    .regex(/^[A-Za-z_]{1,40}$/)
    .optional()
    .catch(undefined),
});

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next = "/", error } = await parsePageInput(searchSchema, searchParams, {});
  if (await getViewer()) redirect(next);
  return <LoginForm next={next} linkError={Boolean(error)} />;
}
