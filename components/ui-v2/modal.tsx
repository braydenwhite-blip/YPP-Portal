"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * Design System 2.0 modal chassis. Backdrop + focus-managed dialog panel with
 * the standard fade/spring entrance; content stays caller-owned. Escape and
 * backdrop click call `onClose` unless `locked` (e.g. while a server action
 * is in flight). One modal per surface; stacking is a review flag.
 */
const modalPanelVariants = cva(
  [
    "flex w-full flex-col gap-4 rounded-2xl bg-surface p-6",
    "shadow-[0_24px_60px_rgba(15,7,36,0.32)] outline-none",
  ],
  {
    variants: {
      size: {
        sm: "max-w-[440px]",
        md: "max-w-[560px]",
        lg: "max-w-[640px]",
      },
      accent: {
        none: "",
        brand: "border-t-4 border-t-brand-600",
        warning: "border-t-4 border-t-warning-700",
        danger: "border-t-4 border-t-danger-700",
      },
    },
    defaultVariants: { size: "lg", accent: "none" },
  }
);

export function ModalV2({
  open,
  onClose,
  labelledBy,
  locked = false,
  size,
  accent,
  role = "dialog",
  className,
  children,
  motionKey = "modal",
}: {
  open: boolean;
  /** Backdrop click / Escape. Ignored while `locked`. */
  onClose: () => void;
  /** id of the heading element inside the panel (aria-labelledby). */
  labelledBy?: string;
  /** Block dismissal (submit in flight, acknowledgement required). */
  locked?: boolean;
  /** Dialog role; error/race-recovery surfaces use `alertdialog`. */
  role?: "dialog" | "alertdialog";
  className?: string;
  children: React.ReactNode;
  motionKey?: string;
} & VariantProps<typeof modalPanelVariants>) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !locked) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, locked, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key={`${motionKey}-backdrop`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[rgba(15,7,36,0.5)] px-5 py-[5vh] backdrop-blur-[10px]"
          onClick={() => {
            if (!locked) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            className={cn(modalPanelVariants({ size, accent }), className)}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Standard right-aligned modal footer row for Cancel/Confirm pairs. */
export function ModalFooterV2({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      {children}
    </div>
  );
}
