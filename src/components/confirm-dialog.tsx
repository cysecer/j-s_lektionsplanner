"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Confirmation before destructive actions. The trigger is any element
 * (usually a button); `onConfirm` runs only after explicit confirmation.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
}: {
  trigger: ReactNode;
  title?: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("dialog.areYouSure")}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="h-11"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                setOpen(false);
              }
            }}
          >
            {confirmLabel ?? t("dialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
