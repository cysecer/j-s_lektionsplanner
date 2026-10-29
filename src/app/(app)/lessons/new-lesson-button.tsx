import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Opens an empty, not yet stored lesson; "Entwurf speichern" creates it. */
export function NewLessonButton() {
  const t = useTranslations("lessons");
  return (
    <Button asChild className="h-11">
      <Link href="/lessons/new">
        <Plus aria-hidden />
        {t("new")}
      </Link>
    </Button>
  );
}
