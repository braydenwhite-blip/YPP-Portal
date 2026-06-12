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
    <div
      className="sticky bottom-0 z-20 -mx-1 border-t border-line bg-surface/95 px-1 py-3 backdrop-blur"
      role="contentinfo"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{status}</div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
