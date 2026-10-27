import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { WelcomePrompt } from "./welcome-prompt";

/** Landing page after accepting an invitation: push for a passkey right away. */
export default async function WelcomePage() {
  const viewer = await requireViewer();
  if ((await db.passkey.count({ where: { userId: viewer.userId } })) > 0) redirect("/");
  return (
    <div className="mx-auto max-w-xl">
      <WelcomePrompt />
    </div>
  );
}
