import "server-only";
import type { SmtpSecurity } from "@/generated/prisma/enums";
import { openSecret, sealSecret } from "@/lib/crypto/secret-box";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ActionFailure } from "@/lib/server/result";

const PURPOSE = "smtp-password";

/** Encrypted for storage; bound to the club so it cannot be copied elsewhere. */
export function sealSmtpPassword(clubId: string, password: string): string {
  return sealSecret(env.AUTH_SECRET, PURPOSE, clubId, password);
}

function openSmtpPassword(clubId: string, sealed: string): string {
  const password = openSecret(env.AUTH_SECRET, PURPOSE, clubId, sealed);
  // AUTH_SECRET was changed: the admin has to enter the password again.
  if (password === null) throw new ActionFailure("internal", "mailPasswordLost");
  return password;
}

/** False when the stored password can no longer be decrypted (key changed). */
export function smtpPasswordReadable(clubId: string, sealed: string): boolean {
  return openSecret(env.AUTH_SECRET, PURPOSE, clubId, sealed) !== null;
}

export type MailTransportConfig = {
  host: string;
  port: number;
  /** Implicit TLS. */
  secure: boolean;
  /** STARTTLS is mandatory. */
  requireTLS: boolean;
  auth?: { user: string; pass: string };
  from: string | { name: string; address: string };
};

export function securityOptions(security: SmtpSecurity) {
  if (security === "NONE" && env.SMTP_REQUIRE_TLS) {
    // Saved while allowed, but the server now insists on encryption.
    throw new ActionFailure("internal", "mailInsecure");
  }
  return { secure: security === "TLS", requireTLS: security === "STARTTLS" };
}

/**
 * The club's mail server from the settings, otherwise the server
 * environment. Without either, sending fails with "mailNotConfigured".
 */
export async function mailConfigFor(clubId: string | null): Promise<MailTransportConfig> {
  const club = clubId
    ? await db.mailSettings.findUnique({
        where: { clubId },
        include: { club: { select: { name: true } } },
      })
    : null;
  if (club) {
    return {
      host: club.host,
      port: club.port,
      ...securityOptions(club.security),
      auth: club.username
        ? {
            user: club.username,
            pass: club.passwordEncrypted
              ? openSmtpPassword(club.clubId, club.passwordEncrypted)
              : "",
          }
        : undefined,
      from: { name: club.fromName ?? club.club.name, address: club.fromEmail },
    };
  }
  if (env.SMTP_HOST && env.MAIL_FROM) {
    return {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      requireTLS: env.SMTP_REQUIRE_TLS && !env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } : undefined,
      from: env.MAIL_FROM,
    };
  }
  throw new ActionFailure("internal", "mailNotConfigured");
}
