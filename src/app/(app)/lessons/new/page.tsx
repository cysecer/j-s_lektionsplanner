import { requireViewer } from "@/lib/auth/session";
import { getLessonOptions } from "@/lib/lessons/queries";
import { newLessonValues } from "@/lib/lessons/service";
import { LessonEditor } from "../[id]/lesson-editor";

/**
 * A new lesson in the editor, not stored yet: nothing is saved until
 * "Entwurf speichern", so leaving the page leaves no empty draft behind.
 */
export default async function NewLessonPage() {
  const viewer = await requireViewer("COACH");
  const general = await newLessonValues(viewer);
  const options = await getLessonOptions(
    viewer.clubId,
    viewer.teams,
    null,
    general.presentCoachIds,
  );
  return (
    <LessonEditor
      lessonId={null}
      initialVersion=""
      initialGeneral={general}
      initialItems={[]}
      options={options}
      creator={{ name: viewer.name, createdAt: new Date().toISOString() }}
    />
  );
}
