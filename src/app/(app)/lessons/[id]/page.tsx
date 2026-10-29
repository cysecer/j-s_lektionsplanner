import { notFound } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { lessonToEditorValues } from "@/lib/lessons/editor-values";
import { getLesson, getLessonOptions } from "@/lib/lessons/queries";
import { visibleLessonsWhere } from "@/lib/lessons/visibility";
import { parsePageInput } from "@/lib/server/params";
import { LessonEditor } from "./lesson-editor";
import { LessonDocumentPage } from "./lesson-document-page";

export default async function LessonPage({ params, searchParams }: PageProps<"/lessons/[id]">) {
  const viewer = await requireViewer();
  const { id } = await parsePageInput(z.object({ id: z.uuid() }), params);
  const lesson = await getLesson(visibleLessonsWhere(viewer), id);
  if (!lesson) notFound();

  if (!viewer.permissions.editLessons) {
    const { layout } = await parsePageInput(
      z.object({ layout: z.uuid().optional().catch(undefined) }),
      searchParams,
    );
    return <LessonDocumentPage viewer={viewer} lessonId={lesson.id} layoutId={layout} />;
  }

  const usedCoachIds = [
    ...lesson.presentCoaches.map((c) => c.coachId),
    ...lesson.items.map((i) => i.responsibleCoachId).filter((x): x is string => Boolean(x)),
  ];
  const options = await getLessonOptions(viewer.clubId, lesson.teamId, usedCoachIds);
  const values = lessonToEditorValues(lesson);

  return (
    <LessonEditor
      lessonId={lesson.id}
      initialVersion={values.version}
      initialGeneral={values.general}
      initialItems={values.items}
      options={options}
      creator={{ name: lesson.createdBy?.name ?? null, createdAt: lesson.createdAt.toISOString() }}
    />
  );
}
