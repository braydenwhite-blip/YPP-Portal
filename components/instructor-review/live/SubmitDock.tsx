"use client";

import type { ReactNode } from "react";

type SubmitDockShellProps = {
  status: ReactNode;
  actions: ReactNode;
};

/**
 * Layout-only sticky dock for the live interview workspace. Takes a left
 * `status` slot (e.g. SaveChip + missing-fields summary) and a right `actions`
 * slot (Save Draft + Submit buttons). Render this inside the editor's <form>
 * so the submit buttons still post the FormData natively.
 */
export function SubmitDockShell({ status, actions }: SubmitDockShellProps) {
  return (
    <div className="iv-live-submit-dock" role="contentinfo">
      <div className="iv-live-submit-dock-inner">
        <div className="iv-live-submit-dock-status">{status}</div>
        <div className="iv-live-submit-dock-actions">{actions}</div>
      </div>
    </div>
  );
}
