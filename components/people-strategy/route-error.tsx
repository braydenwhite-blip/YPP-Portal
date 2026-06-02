"use client";

import { useEffect } from "react";

import { reportClientError } from "@/lib/client-error-report";

export function PeopleStrategyRouteError({
  error,
  reset,
  surface,
  backHref,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  surface: string;
  backHref: string;
}) {
  useEffect(() => {
    reportClientError(`people-strategy:${surface}`, error);
  }, [error, surface]);

  return (
    <div className="page-shell" style={{ maxWidth: 680 }}>
      <div className="card" role="alert" style={{ padding: 20 }}>
        <p className="badge">People Strategy</p>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          Could not load this screen
        </h1>
        <p className="page-subtitle">
          Something interrupted {surface}. Reload this screen, or go back to the nearest People Strategy page.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" className="button small" onClick={reset}>
            Reload
          </button>
          <a href={backHref} className="button outline small">
            Go back
          </a>
        </div>
      </div>
    </div>
  );
}
