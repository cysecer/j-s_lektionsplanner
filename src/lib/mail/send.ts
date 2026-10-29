import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { ActionFailure } from "@/lib/server/result";
import { mailConfigFor, type MailTransportConfig } from "./config";

const mailSchema = z.object({
  to: z.array(z.email()).min(1).max(50),
  replyTo: z.email().optional(),
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
        // Letters of every language (the PDF names are translated), no quotes or slashes.
        filename: z.string().regex(/^[\p{L}\p{N}._\- ]{1,200}$/u),
        content: z.instanceof(Buffer),
        contentType: z.literal("application/pdf"),
      }),
    )
    .max(5)
    .optional(),
});

export type Mail = z.infer<typeof mailSchema>;

/** Nodemailer error codes → messages the UI can explain. */
function failureCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "EAUTH" || code === "ENOAUTH") return "mailAuth";
  if (code === "ETLS" || code === "EREQUIRETLS") return "mailTls";
  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "EDNS" || code === "ESOCKET") {
    return "mailConnection";
  }
  return "mailFailed";
}

export async function sendWith(config: MailTransportConfig, mail: Mail): Promise<void> {
  const parsed = mailSchema.parse(mail);
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    // Never send mail (or credentials) over an unencrypted connection to a real server.
    requireTLS: config.requireTLS,
    auth: config.auth,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  try {
    await transport.sendMail({ from: config.from, ...parsed });
  } catch (error) {
    console.error("[mail] sending failed", (error as Error).message);
    throw new ActionFailure("internal", failureCode(error));
  } finally {
    transport.close();
  }
}

/** Sends through the club's mail server (or the server's fallback). */
export async function sendMail(clubId: string | null, mail: Mail): Promise<void> {
  await sendWith(await mailConfigFor(clubId), mail);
}
