import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto grid max-w-md gap-4 text-center">
      <h1 className="text-2xl font-semibold">{t("errors.forbidden")}</h1>
      <Button asChild className="h-11">
        <Link href="/">{t("common.back")}</Link>
      </Button>
    </div>
  );
}
