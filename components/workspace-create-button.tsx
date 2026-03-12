"use client";

import { useState } from "react";
import { CreateContentModal } from "./create-content-modal";

/**
 * Minimal client component that owns the create-modal open state.
 * Rendered inside the instructor workspace server page's topbar.
 */
export function WorkspaceCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="button primary"
        onClick={() => setOpen(true)}
        style={{ whiteSpace: "nowrap" }}
      >
        + Create
      </button>

      <CreateContentModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
