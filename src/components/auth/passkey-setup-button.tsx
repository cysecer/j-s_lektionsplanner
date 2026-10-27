"use client";

import { Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

/** Rough, human-readable device label for the passkey list. */
function deviceName(fallback: string): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : fallback;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return browser ? `${os} · ${browser}` : os;
}

export function PasskeySetupButton({
  onDone,
  label,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & { onDone?: () => void; label?: string }) {
  const t = useTranslations("auth.account");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function add() {
    setBusy(true);
    setMessage(undefined);
    const result = await authClient.passkey.addPasskey({ name: deviceName(t("unknownDevice")) });
    setBusy(false);
    if (result?.error) {
      setMessage({ ok: false, text: t("passkeyAddFailed") });
      return;
    }
    setMessage({ ok: true, text: t("passkeyAdded") });
    router.refresh();
    onDone?.();
  }

  return (
    <div className="grid gap-2">
      <Button onClick={add} disabled={busy} {...props}>
        <Fingerprint aria-hidden className="size-5" />
        {label ?? t("addPasskey")}
      </Button>
      {message ? (
        <p
          role="status"
          className={message.ok ? "text-sm text-green-700" : "text-destructive text-sm"}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
