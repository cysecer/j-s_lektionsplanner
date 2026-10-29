"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { setClubLogoAction } from "./actions";

export function LogoEditor({
  logoAssetId,
  clubName,
}: {
  logoAssetId: string | null;
  clubName: string;
}) {
  const t = useTranslations();
  const { run, pending } = useAction(setClubLogoAction);

  return (
    <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-start">
      <div className="bg-muted/40 flex aspect-square items-center justify-center rounded-lg border p-3">
        {logoAssetId ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked asset route
          <img
            src={`/api/assets/${logoAssetId}`}
            alt={t("settings.club.logoAlt", { name: clubName })}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-muted-foreground text-center text-sm">{t("settings.club.noLogo")}</p>
        )}
      </div>
      <div className="grid gap-3">
        <ImageUpload
          purpose="logo"
          onUploaded={(image) => run({ assetId: image.id }, { success: t("common.saved") })}
        />
        {logoAssetId ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="h-11 justify-self-start" disabled={pending}>
                {t("settings.club.removeLogo")}
              </Button>
            }
            description={t("settings.club.removeLogoConfirm")}
            confirmLabel={t("settings.club.removeLogo")}
            onConfirm={async () => {
              await run({ assetId: null });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
