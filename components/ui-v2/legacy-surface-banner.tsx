import { ButtonLink } from "./button";

/**
 * Consolidation banner for legacy operational pages (plan §15/§20): the new
 * ui-v2 surface is the front door; the legacy page stays only for its unique
 * management tooling. Tailwind-only subtree — allowed on legacy pages per the
 * hybrid rules, and removed when the page itself is absorbed or retired.
 */
export function LegacySurfaceBanner({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  /** The headline ("Work Hub is the front door for actions now."). */
  title: string;
  /** Why this page still exists ("this page keeps the editing tools"). */
  body: string;
  /** CTA text ("Open Work Hub"). */
  ctaLabel: string;
  /** The new surface ("/work?view=actions"). */
  ctaHref: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line-soft bg-surface-soft px-5 py-3.5">
      <p className="m-0 text-[13.5px] text-ink">
        <span className="font-semibold">{title}</span>{" "}
        <span className="text-ink-muted">{body}</span>
      </p>
      <ButtonLink href={ctaHref} variant="secondary" size="sm">
        {ctaLabel} →
      </ButtonLink>
    </div>
  );
}
