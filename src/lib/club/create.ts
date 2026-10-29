import type { Prisma } from "@/generated/prisma/client";
import { COMPACT_LAYOUT, DEFAULT_LAYOUT, layoutConfigSchema } from "@/lib/layout/schema";

/**
 * A new, empty club with what every club needs: the three sections
 * (Einleitung, Hauptteil, Ausklang) and the two built-in PDF layouts,
 * "Standard" being the default. Used by `setup` and the demo seed.
 */
export async function createClubBase(
  tx: Prisma.TransactionClient,
  input: { name: string; pdfFooterText?: string | null },
) {
  const club = await tx.club.create({
    data: { name: input.name, pdfFooterText: input.pdfFooterText ?? null },
  });
  const clubId = club.id;

  const standard = await tx.layout.create({
    data: { clubId, name: "Standard", config: layoutConfigSchema.parse(DEFAULT_LAYOUT) },
  });
  await tx.layout.create({
    data: { clubId, name: "Kompakt", config: layoutConfigSchema.parse(COMPACT_LAYOUT) },
  });
  await tx.club.update({ where: { id: clubId }, data: { defaultLayoutId: standard.id } });

  const sections = {
    INTRO: (await tx.section.create({ data: { clubId, builtin: "INTRO", sortOrder: 0 } })).id,
    MAIN: (await tx.section.create({ data: { clubId, builtin: "MAIN", sortOrder: 1 } })).id,
    END: (await tx.section.create({ data: { clubId, builtin: "END", sortOrder: 2 } })).id,
  };
  return { club, clubId, defaultLayoutId: standard.id, sections };
}
