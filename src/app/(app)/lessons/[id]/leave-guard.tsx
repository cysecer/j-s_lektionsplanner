"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * While `active`, links inside the app (header, "Alle Lektionen", …) do not
 * leave the page right away: the click is held and `target` set, so a
 * dialog can ask first. Reloading or closing the tab shows the browser's
 * own "leave page?" question.
 */
export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!activeRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.download) {
        return;
      }
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      // Capture phase on the document: runs before Next.js' link handler.
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (activeRef.current) event.preventDefault();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return {
    target,
    cancel: () => setTarget(null),
    /** Leaves for the held link. */
    leave: () => {
      const href = target;
      activeRef.current = false;
      setTarget(null);
      if (href) router.push(href);
    },
  };
}

/** The question shown for a held link; the buttons decide what happens. */
export function LeaveDialog({
  open,
  title,
  description,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap gap-2">{children}</AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
