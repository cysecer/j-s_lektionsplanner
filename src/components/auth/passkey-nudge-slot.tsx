import { cookies } from "next/headers";
import type { Viewer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PASSKEY_NUDGE_COOKIE, PasskeyNudge } from "./passkey-nudge";

/** Passkey banner for the main pages, until the user has one or postponed it. */
export async function PasskeyNudgeSlot({ viewer }: { viewer: Viewer }) {
  const [passkeys, cookieStore] = await Promise.all([
    db.passkey.count({ where: { userId: viewer.userId } }),
    cookies(),
  ]);
  if (passkeys > 0 || cookieStore.get(PASSKEY_NUDGE_COOKIE)?.value === "dismissed") return null;
  return (
    <div className="mb-6">
      <PasskeyNudge />
    </div>
  );
}
