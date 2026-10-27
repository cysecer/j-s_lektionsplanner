"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGE_NAMES, LOCALES, localeSchema } from "@/i18n/config";
import { errorMessage } from "@/lib/i18n-keys";
import { setLocaleAction } from "@/lib/preferences/actions";

export function LanguageSwitcher({ showName = false }: { showName?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(value: string) {
    const parsed = localeSchema.safeParse(value);
    if (!parsed.success || parsed.data === locale) return;
    startTransition(async () => {
      const result = await setLocaleAction({ locale: parsed.data });
      if (!result.ok) toast.error(errorMessage(t, result.error));
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11"
          disabled={pending}
          aria-label={t("header.language")}
        >
          <Languages aria-hidden className="size-5" />
          <span className={showName ? "" : "sr-only lg:not-sr-only"}>
            {LANGUAGE_NAMES[locale as keyof typeof LANGUAGE_NAMES]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("header.language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={change}>
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l} className="min-h-10">
              {LANGUAGE_NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
