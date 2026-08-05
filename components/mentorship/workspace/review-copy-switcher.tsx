"use client";

import Link from "next/link";

export type ReviewCopyOption = {
  id: string;
  title: string;
  statusLabel: string;
  href: string;
  /** Printable PDF for this copy — drafts and sent alike. */
  pdfHref?: string;
};

/**
 * Switch between existing review document copies. Title / month are set only
 * when creating a new review (New Review modal), not here.
 */
export function ReviewCopySwitcher({
  copies,
  activeId,
}: {
  copies: ReviewCopyOption[];
  activeId: string | null;
  /** @deprecated Meta editing moved to New Review — ignored. */
  canEditMeta?: boolean;
  /** @deprecated Ignored. */
  initialTitle?: string;
  /** @deprecated Ignored. */
  initialMonthKey?: string;
}) {
  if (copies.length === 0) return null;

  const activeCopy = copies.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#e8e4f0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 mr-1 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
          Copies
        </p>
        {copies.map((copy) => {
          const active = copy.id === activeId;
          return (
            <Link
              key={copy.id}
              href={copy.href}
              className={
                active
                  ? "rounded-full bg-brand-600 px-3 py-1 text-[12.5px] font-semibold text-white no-underline"
                  : "rounded-full bg-[#f3f0f8] px-3 py-1 text-[12.5px] font-medium text-ink no-underline hover:bg-brand-50"
              }
            >
              {copy.title}
              <span className="ml-1.5 opacity-70">{copy.statusLabel}</span>
            </Link>
          );
        })}
        {activeCopy?.pdfHref ? (
          <a
            href={activeCopy.pdfHref}
            className="ml-auto rounded-full border border-line-soft bg-white px-3 py-1 text-[12.5px] font-semibold text-ink no-underline hover:border-brand-300 hover:text-brand-800"
          >
            Print PDF
          </a>
        ) : null}
      </div>
    </div>
  );
}
