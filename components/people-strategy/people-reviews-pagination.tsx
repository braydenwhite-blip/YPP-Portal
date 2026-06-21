"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const PAGE_SIZE = 10;

export function PeopleReviewsPagination({
  total,
  page,
  basePath = "/people",
}: {
  total: number;
  page: number;
  basePath?: string;
}) {
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  if (total === 0) return null;

  const navBtn =
    "inline-flex size-8 items-center justify-center rounded-lg text-[#9a9ab0] no-underline hover:bg-[#f4f4f8]";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f1f1f6] px-4 py-3">
      <p className="m-0 text-[12.5px] text-[#9a9ab0]">
        Showing {start} to {end} of {total} {total === 1 ? "person" : "people"}
      </p>
      <div className="flex items-center gap-1">
        {safePage <= 1 ? (
          <span className={`${navBtn} opacity-40`} aria-hidden>
            ‹
          </span>
        ) : (
          <Link href={pageHref(safePage - 1)} className={navBtn} aria-label="Previous page">
            ‹
          </Link>
        )}
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#6b21c8] text-[12.5px] font-bold text-white">
          {safePage}
        </span>
        {safePage >= totalPages ? (
          <span className={`${navBtn} opacity-40`} aria-hidden>
            ›
          </span>
        ) : (
          <Link href={pageHref(safePage + 1)} className={navBtn} aria-label="Next page">
            ›
          </Link>
        )}
      </div>
    </div>
  );
}

export function paginateRows<T>(rows: T[], page: number): T[] {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE);
}

export { PAGE_SIZE as PEOPLE_REVIEWS_PAGE_SIZE };
