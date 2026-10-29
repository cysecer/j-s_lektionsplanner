"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId } from "react";

/** Shows the lesson in another layout (?layout=…); the lesson itself is not changed. */
export function LayoutSwitcher({
  layouts,
  current,
}: {
  layouts: { id: string; name: string }[];
  current: string;
}) {
  const t = useTranslations("lessons.preview");
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
      {t("layout")}
      <select
        id={id}
        value={current}
        onChange={(e) => router.replace(`${pathname}?layout=${encodeURIComponent(e.target.value)}`)}
        className="border-input bg-background focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-base outline-none focus-visible:ring-3"
      >
        {layouts.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
