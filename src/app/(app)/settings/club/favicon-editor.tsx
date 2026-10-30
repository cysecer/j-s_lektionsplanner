"use client";

import { useTranslations } from "next-intl";
import { AssetImage } from "@/components/asset-image";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { setClubFaviconAction } from "./actions";

/** The browser tab icon: preview in the sizes browsers show it, upload, remove. */
export function FaviconEditor({ faviconAssetId }: { faviconAssetId: string | null }) {
  const t = useTranslations();
  const { run, pending } = useAction(setClubFaviconAction);

  return (
    <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-start">
      <div className="bg-muted/40 flex aspect-square items-center justify-center gap-4 rounded-lg border p-3">
        {faviconAssetId ? (
          [16, 32, 64].map((size) => (
            <AssetImage
              key={size}
              assetId={faviconAssetId}
              alt={size === 64 ? t("settings.club.faviconAlt") : ""}
              className="object-contain"
              style={{ width: size, height: size }}
            />
          ))
        ) : (
          <p className="text-muted-foreground text-center text-sm">
            {t("settings.club.noFavicon")}
          </p>
        )}
      </div>
      <div className="grid gap-3">
        <ImageUpload
          purpose="favicon"
          onUploaded={(image) => run({ assetId: image.id }, { success: t("common.saved") })}
        />
        {faviconAssetId ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="h-11 justify-self-start" disabled={pending}>
                {t("settings.club.removeFavicon")}
              </Button>
            }
            description={t("settings.club.removeFaviconConfirm")}
            confirmLabel={t("settings.club.removeFavicon")}
            onConfirm={async () => {
              await run({ assetId: null });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
