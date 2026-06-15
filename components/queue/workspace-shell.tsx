import { cn } from "@/components/ui-v2";

/**
 * Full-screen workspace layout system (Queue Engine §full-screen-standard).
 *
 * Operating surfaces are workspaces, not narrow centered pages: the shell uses
 * the full content width with a calm layered backdrop, a sticky command header,
 * a main operating canvas, an optional right context rail, and a collapsed
 * "Browse all" at the very bottom. Internal panels scroll; the page does not
 * stretch into endless vertical scroll.
 */

/** Calm, premium backdrop — layered gradients + a faint ringed orb. Decorative. */
function WorkspaceBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50/70 via-surface to-surface-soft" />
      <div className="absolute -right-40 -top-40 size-[520px] rounded-full bg-brand-200/30 blur-3xl" />
      <div className="absolute -left-32 top-1/3 size-[420px] rounded-full bg-brand-100/40 blur-3xl" />
      <div className="absolute right-24 top-20 hidden size-44 rounded-full border border-brand-200/50 lg:block" />
      <div className="absolute right-10 top-44 hidden size-2 rounded-full bg-brand-300/60 lg:block" />
      <div className="absolute right-56 top-12 hidden size-1.5 rounded-full bg-brand-300/50 lg:block" />
    </div>
  );
}

export function WorkspaceShell({
  children,
  backdrop = true,
  className,
}: {
  children: React.ReactNode;
  backdrop?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative isolate min-h-[70vh] w-full", className)}>
      {backdrop ? <WorkspaceBackdrop /> : null}
      <div className="mx-auto w-full max-w-[1760px]">{children}</div>
    </div>
  );
}

/** Sticky command header — eyebrow + title + lede + actions, glassy on scroll. */
export function WorkspaceHeader({
  eyebrow,
  title,
  lede,
  actions,
  children,
  sticky = true,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <header
      className={cn(
        "z-30 -mx-1 mb-5 rounded-b-[18px] px-1 pb-4 pt-2",
        sticky && "sticky top-0 bg-surface-soft/80 backdrop-blur supports-[backdrop-filter]:bg-surface-soft/70"
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-700">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="m-0 text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[36px]">
            {title}
          </h1>
          {lede ? (
            <p className="m-0 mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-ink-muted">
              {lede}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}

/** Two-pane workspace body: main operating canvas + optional right rail. */
export function WorkspaceBody({
  children,
  rail,
  className,
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
  className?: string;
}) {
  if (!rail) {
    return <div className={cn("flex flex-col gap-5", className)}>{children}</div>;
  }
  return (
    <div
      className={cn(
        "grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <div className="flex flex-col gap-4 xl:sticky xl:top-24">{rail}</div>
    </div>
  );
}

/** The demoted full list — collapsed by default, opened on demand. */
export function BrowseAllPanel({
  label = "Browse all",
  hint,
  defaultOpen = false,
  children,
}: {
  label?: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group mt-2 rounded-[14px] border border-line-soft bg-surface/70 shadow-card [&_summary::-webkit-details-marker]:hidden"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="flex items-center gap-2.5">
          <span className="text-[15px] font-bold text-ink">{label}</span>
          {hint ? <span className="text-[12.5px] text-ink-muted">{hint}</span> : null}
        </span>
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
          <span className="group-open:hidden">Expand</span>
          <span className="hidden group-open:inline">Collapse</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="transition-transform duration-200 group-open:rotate-180"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-line-soft p-5">{children}</div>
    </details>
  );
}
