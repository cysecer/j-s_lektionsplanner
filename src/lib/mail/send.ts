import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { env } from "@/lib/env";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  // Never send mail (or credentials) over an unencrypted connection to a real server.
  requireTLS: env.SMTP_REQUIRE_TLS && !env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } : undefined,
});

const mailSchema = z.object({
  to: z.array(z.email()).min(1).max(50),
  subject: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => !/[\r\n]/.test(s), "no line breaks in subject"),
  text: z.string().min(1).max(100_000),
  html: z.string().max(200_000).optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().regex(/^[\w.\- äöüÄÖÜéèàç]{1,150}$/),
        content: z.instanceof(Buffer),
        contentType: z.literal("application/pdf"),
      }),
    )
    .max(5)
    .optional(),
});

export type Mail = z.infer<typeof mailSchema>;

export async function sendMail(mail: Mail): Promise<void> {
  const parsed = mailSchema.parse(mail);
  await transport.sendMail({ from: env.MAIL_FROM, ...parsed });
}
