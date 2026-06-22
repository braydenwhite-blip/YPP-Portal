import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * Design System 2.0 button. One primary per view; secondary for the rest;
 * ghost for inline affordances; danger only for destructive actions.
 *
 * YPP Portal reskin: `primary` carries the signature purple gradient
 * (#5a1da8 → #6b21c8 → #8b3fe8). Every variant ships default / hover /
 * active / focus-visible / disabled states; `<Button loading>` adds a busy
 * spinner state. Signatures are unchanged, so existing call sites keep working.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-[9px] border font-sans font-semibold transition-[filter,background-color,border-color,color] duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-busy:pointer-events-none aria-busy:cursor-progress",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-transparent text-white shadow-card bg-[linear-gradient(135deg,#5a1da8_0%,#6b21c8_52%,#8b3fe8_100%)] hover:brightness-[1.07] active:brightness-95",
        secondary:
          "border-line bg-surface text-brand-800 hover:border-brand-400 hover:bg-brand-50 active:bg-brand-100",
        ghost:
          "border-transparent bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100",
        danger:
          "border-transparent bg-danger-700 text-white hover:bg-danger-700/90 active:bg-danger-700",
      },
      size: {
        sm: "h-8 px-3 text-[12.5px]",
        md: "h-9.5 px-4 text-[13.5px]",
        lg: "h-11 px-5 text-[14px]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

/** Inline busy spinner sized to the button's text. */
function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Show a spinner and mark the control busy + unclickable. */
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, type, loading, disabled, children, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Spinner /> : null}
        {children}
      </button>
    );
  }
);

export function ButtonLink({
  href,
  className,
  variant,
  size,
  children,
  prefetch,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  prefetch?: boolean;
} & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </Link>
  );
}
