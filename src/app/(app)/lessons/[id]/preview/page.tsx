import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { parsePageInput } from "@/lib/server/params";
import { LessonDocumentPage } from "../lesson-document-page";

export default async function LessonPreviewPage({
  params,
  searchParams,
}: PageProps<"/lessons/[id]/preview">) {
  const viewer = await requireViewer();
  const { id } = await parsePageInput(z.object({ id: z.uuid() }), params);
  // An invalid ?layout= is ignored (the lesson's own layout is shown).
  const { layout } = await parsePageInput(
    z.object({ layout: z.uuid().optional().catch(undefined) }),
    searchParams,
  );
  return <LessonDocumentPage viewer={viewer} lessonId={id} layoutId={layout} />;
}
