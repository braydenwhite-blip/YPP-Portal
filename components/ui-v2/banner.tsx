"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * Design System 2.0 workflow banner: a full-width notice pinned above a
 * working surface (sync rollback, network recovery, read-only state,
 * notification delivery). Severity is carried by tone; the concrete reason
 * and recovery affordances are caller content — never a bare label.
 */
const bannerVariants = cva(
  "flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3 text-[13px]",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface text-ink",
        brand: "border-brand-600/30 bg-brand-50 text-brand-800",
        success: "border-success-700/30 bg-success-100 text-success-700",
        warning: "border-warning-700/40 bg-warning-100 text-ink",
        danger: "border-danger-700/40 bg-danger-100 text-ink",
        info: "border-info-700/30 bg-info-100 text-ink",
      },
      sticky: {
        true: "sticky top-2 z-[55] shadow-[0_10px_30px_rgba(15,7,36,0.14)]",
        false: "",
      },
    },
    defaultVariants: { tone: "neutral", sticky: false },
  }
);

export function BannerV2({
  open = true,
  tone,
  sticky,
  role = "status",
  icon,
  title,
  actions,
  className,
  children,
  motionKey = "banner",
}: {
  /** Animated mount/unmount when toggled; render-once banners can omit it. */
  open?: boolean;
  role?: "status" | "alert";
  icon?: React.ReactNode;
  /** Bold lead-in ("Decision rolled back", "Read-only"). */
  title?: string;
  /** Right-aligned recovery affordances (retry, resend, dismiss). */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  motionKey?: string;
} & VariantProps<typeof bannerVariants>) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key={motionKey}
          role={role}
          aria-live={role === "alert" ? "assertive" : "polite"}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className={cn(bannerVariants({ tone, sticky }), className)}
        >
          {icon ? (
            <span aria-hidden className="text-[16px] leading-none">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {title ? <span className="font-bold">{title} </span> : null}
            {children}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
