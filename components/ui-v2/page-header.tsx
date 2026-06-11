import Link from "next/link";

import { cn } from "./cn";

/**
 * Standard page header for Knowledge OS surfaces: eyebrow/back link, title,
 * one-line subtitle, primary + secondary actions on the right, and an
 * optional full-width slot underneath (stat strip, filter bar).
 */
export function PageHeaderV2({
  title,
  subtitle,
  eyebrow,
  backHref,
  backLabel,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Small uppercase label above the title ("Admin", "Work Hub", …). */
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  /** Right-aligned actions (Buttons / ButtonLinks). */
  actions?: React.ReactNode;
  /** Full-width slot under the heading row (stat strip, filters). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {backHref ? (
            <Link
              href={backHref}
              className="mb-1 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline"
            >
              ← {backLabel ?? "Back"}
            </Link>
          ) : null}
          {eyebrow ? (
            <p className="mb-1 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-sans text-[28px] font-bold leading-tight tracking-[-0.01em] text-ink">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-[14px] leading-snug text-ink-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
