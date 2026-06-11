import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * Design System 2.0 button. One primary per view; secondary for the rest;
 * ghost for inline affordances; danger only for destructive actions.
 */
export const buttonVariants = cva(
  [
    "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-[8px] border font-sans font-semibold transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-brand-600 text-white shadow-card hover:bg-brand-700",
        secondary:
          "border-line bg-surface text-brand-800 hover:border-brand-400 hover:bg-brand-50",
        ghost:
          "border-transparent bg-transparent text-brand-700 hover:bg-brand-50",
        danger:
          "border-transparent bg-danger-700 text-white hover:bg-danger-700/90",
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

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, type, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
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
