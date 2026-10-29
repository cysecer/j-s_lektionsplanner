/**
 * First-time setup on a new server: creates the (empty) club and invites
 * the first administrator.
 *
 *   npm run setup -- --club "TV Muster" --admin jan@example.ch [--footer "J+S-Kindersport"] [--locale de-CH]
 *
 * In Docker: docker compose -f docker-compose.prod.yml run --rm tools setup --club … --admin …
 *
 * Refuses to run when a club exists already; invite further people in the
 * app (Einstellungen → Personen) or with `invite`.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { z } from "zod";
import { createClubBase } from "@/lib/club/create";
import { db } from "@/lib/db";
import { createInvitation } from "@/lib/invitations/create";
import { displayName } from "@/lib/settings/schemas";

const argsSchema = z.strictObject({
  club: displayName(100),
  admin: z.email().max(254),
  footer: displayName(120).optional(),
  locale: z.enum(["de-CH", "fr-CH", "it-CH", "rm", "en"]).default("de-CH"),
});

async function main() {
  const { values } = parseArgs({
    options: {
      club: { type: "string" },
      admin: { type: "string" },
      footer: { type: "string" },
      locale: { type: "string" },
    },
    strict: true,
  });
  const args = argsSchema.safeParse(values);
  if (!args.success) {
    console.error(
      'Usage: setup --club "<club name>" --admin <email> [--footer "<PDF footer>"] [--locale de-CH]',
    );
    console.error(z.prettifyError(args.error));
    process.exitCode = 1;
    return;
  }

  if ((await db.club.count()) > 0) {
    console.error(
      "A club exists already. Invite people in the app (Einstellungen → Personen) or with `invite`.",
    );
    process.exitCode = 1;
    return;
  }

  const { clubId } = await db.$transaction((tx) =>
    createClubBase(tx, { name: args.data.club, pdfFooterText: args.data.footer ?? null }),
  );
  console.log(`Club "${args.data.club}" created.`);

  const { url, emailError } = await createInvitation({
    clubId,
    email: args.data.admin,
    access: { kind: "admin" },
    coachId: null,
    locale: args.data.locale,
    invitedById: null,
  });
  // Usually no mail server is set up yet: open the link yourself.
  console.log(
    emailError
      ? `Invitation for ${args.data.admin} (administrator) created; no email sent (${emailError}).`
      : `Invitation for ${args.data.admin} (administrator) sent.`,
  );
  console.log(`Link (valid 7 days): ${url}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
