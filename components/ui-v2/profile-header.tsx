import Link from "next/link";

import { cn } from "./cn";

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Record-page identity header (master plan §22.2, layout pattern 2):
 * avatar/initials, back link, name, one identity line, status badges, and
 * the quick-action row. The header carries identity only — facts belong in
 * KeyFactsGrid, state in the sections below.
 */
export function ProfileHeader({
  name,
  identityLine,
  avatarUrl,
  eyebrow,
  backHref,
  backLabel,
  badges,
  actions,
  className,
}: {
  name: string;
  /** One concrete line under the name ("email · chapter · grade"). */
  identityLine?: string;
  avatarUrl?: string | null;
  /** Small uppercase label above the name ("Instructor record"). */
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  /** StatusBadge row next to the name. */
  badges?: React.ReactNode;
  /** Quick actions (ButtonLinks / Buttons), right-aligned. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "rounded-[12px] border border-line-soft bg-surface p-6 shadow-card",
        className
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          ← {backLabel ?? "Back"}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[18px] font-bold text-brand-700"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- small record avatar, not page-critical.
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              initialsOf(name)
            )}
          </span>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                {eyebrow}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 font-sans text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink">
                {name}
              </h1>
              {badges}
            </div>
            {identityLine ? (
              <p className="m-0 mt-1 text-[13.5px] text-ink-muted">{identityLine}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
