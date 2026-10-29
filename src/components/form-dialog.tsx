"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * A dialog holding a small form. `onSubmit` returns true when saved, which
 * closes the dialog; on failure it stays open with the errors visible.
 */
export function FormDialog({
  trigger,
  title,
  description,
  submitLabel,
  pending,
  onOpen,
  onSubmit,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  pending?: boolean;
  onOpen?: () => void;
  onSubmit: () => Promise<boolean>;
  children: ReactNode;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await onSubmit()) setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpen?.();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-11" disabled={pending}>
              {submitLabel ?? t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
