"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * Design System 2.0 transient toast shell. Fixed-position card with a tone
 * stripe and the standard slide/fade entrance; auto-dismiss timers and
 * content stay caller-owned (toasts carry workflow context — next applicant,
 * retry affordances — not just strings).
 */
const toastVariants = cva(
  [
    "pointer-events-auto flex w-full max-w-[360px] flex-col gap-2 rounded-[12px]",
    "border bg-surface p-4 shadow-[0_18px_44px_rgba(15,7,36,0.24)]",
  ],
  {
    variants: {
      tone: {
        neutral: "border-line border-l-4 border-l-brand-600",
        success: "border-line border-l-4 border-l-success-700",
        warning: "border-line border-l-4 border-l-warning-700",
        danger: "border-line border-l-4 border-l-danger-700",
        info: "border-line border-l-4 border-l-info-700",
      },
      position: {
        "bottom-right": "fixed right-6 z-[70]",
        "bottom-left": "fixed left-6 z-[70]",
      },
    },
    defaultVariants: { tone: "neutral", position: "bottom-right" },
  }
);

export function ToastV2({
  open,
  tone,
  position,
  /** Distance from the bottom edge, so toasts clear sticky docks. */
  bottomOffset = 24,
  role = "status",
  className,
  children,
  motionKey = "toast",
}: {
  open: boolean;
  bottomOffset?: number;
  role?: "status" | "alert";
  className?: string;
  children: React.ReactNode;
  motionKey?: string;
} & VariantProps<typeof toastVariants>) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key={motionKey}
          role={role}
          aria-live={role === "alert" ? "assertive" : "polite"}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18 }}
          style={{ bottom: bottomOffset }}
          className={cn(toastVariants({ tone, position }), className)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
