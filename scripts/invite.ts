/**
 * Invite a person from the command line, e.g. the first administrator:
 *
 *   npm run invite -- --email jan@example.ch --role ADMIN
 *
 * Sends the invitation email and prints the link.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { createInvitation } from "@/lib/invitations/create";

const argsSchema = z.strictObject({
  email: z.email(),
  role: z.enum(Role).default("ADMIN"),
  locale: z.enum(["de-CH", "fr-CH", "it-CH", "rm", "en"]).default("de-CH"),
});

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, role: { type: "string" }, locale: { type: "string" } },
    strict: true,
  });
  const args = argsSchema.safeParse(values);
  if (!args.success) {
    console.error(
      "Usage: npm run invite -- --email <address> [--role ADMIN|COACH|READER] [--locale de-CH]",
    );
    console.error(z.prettifyError(args.error));
    process.exitCode = 1;
    return;
  }

  const clubs = await db.club.findMany({ select: { id: true, name: true }, take: 2 });
  if (clubs.length !== 1) {
    console.error(
      clubs.length === 0
        ? "No club found. Run `npm run db:seed` first."
        : "Several clubs found; not supported by this script yet.",
    );
    process.exitCode = 1;
    return;
  }

  const { url } = await createInvitation({
    clubId: clubs[0]!.id,
    email: args.data.email,
    role: args.data.role,
    coachId: null,
    locale: args.data.locale,
    invitedById: null,
  });
  console.log(`Invitation for ${args.data.email} (${args.data.role}) to ${clubs[0]!.name} sent.`);
  console.log(`Link (valid 7 days): ${url}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
