"use client";

import Link from "next/link";

export default function AdminChapterDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-5">
      <div className="max-w-md text-center">
        <p className="m-0 text-[16px] font-semibold text-ink">Couldn’t load this chapter</p>
        <p className="mt-2 text-[14px] text-ink-muted">
          <button type="button" onClick={() => reset()} className="font-semibold text-brand-700 underline">
            Try again
          </button>
          {" "}or{" "}
          <Link href="/admin/chapters" className="font-semibold text-brand-700">
            back to chapters
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
