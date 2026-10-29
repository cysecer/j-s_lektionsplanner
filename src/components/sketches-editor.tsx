"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ImageUpload } from "@/components/image-upload";
import { MoveButtons, moveItem } from "@/components/move-buttons";
import { Button } from "@/components/ui/button";
import { AssetImage } from "@/components/asset-image";

/** Ordered list of uploaded sketches with thumbnails. */
export function SketchesEditor({
  assetIds,
  onChange,
  max,
  title,
}: {
  assetIds: string[];
  onChange: (ids: string[]) => void;
  max: number;
  title: string;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-3">
      {assetIds.length > 0 ? (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assetIds.map((id, index) => {
            const alt = t("blocks.sketchAlt", { number: index + 1, title: title || "…" });
            return (
              <li key={id} className="grid gap-1 rounded-lg border p-2">
                <AssetImage
                  assetId={id}
                  alt={alt}
                  className="bg-muted/40 aspect-[4/3] w-full rounded object-contain"
                />
                <div className="flex justify-between">
                  <MoveButtons
                    index={index}
                    count={assetIds.length}
                    label={alt}
                    onMove={(from, to) => onChange(moveItem(assetIds, from, to))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`${alt}: ${t("common.remove")}`}
                    onClick={() => onChange(assetIds.filter((x) => x !== id))}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {assetIds.length < max ? (
        <ImageUpload purpose="sketch" onUploaded={(image) => onChange([...assetIds, image.id])} />
      ) : null}
    </div>
  );
}
