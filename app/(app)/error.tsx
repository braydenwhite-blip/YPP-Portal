"use client";

import { useEffect, useState } from "react";
import { reportClientError } from "@/lib/client-error-report";

function reloadKey() {
  if (typeof window === "undefined") return "";
  return `ypp-error-reload:${window.location.pathname}`;
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const key = reloadKey();
    try {
      if (key && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return;
      }
    } catch {
      reset();
      return;
    }
    setStuck(true);
    reportClientError("app-error-boundary", error);
  }, [error, reset]);

  function retry() {
    try {
      sessionStorage.removeItem(reloadKey());
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  if (!stuck) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-5">
        <p className="m-0 text-[14px] text-ink-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-5">
      <div className="w-full max-w-md text-center">
        <h2 className="m-0 font-sans text-[22px] font-semibold text-ink">Couldn’t load this page</h2>
        <p className="mt-2 text-[14px] text-ink-muted">
          Refresh and it should come back. If it doesn’t, return to the dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="rounded-full bg-brand-600 px-6 py-3 text-[14px] font-semibold text-white hover:bg-brand-700"
          >
            Refresh
          </button>
          <a
            href="/admin/chapters"
            className="rounded-full bg-surface-soft px-6 py-3 text-[14px] font-semibold text-ink no-underline hover:bg-brand-50"
          >
            Back to chapters
          </a>
        </div>
      </div>
    </div>
  );
}
