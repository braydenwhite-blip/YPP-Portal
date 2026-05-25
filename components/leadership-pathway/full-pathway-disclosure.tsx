"use client";

import { useState, useId } from "react";

interface FullPathwayDisclosureProps {
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * The "See the full pathway" expand/collapse. A Playfair-styled
 * invitation, not a utilitarian native `<details>` summary — this is
 * the moment we're trying to make feel deliberate and inviting.
 *
 * Children are rendered as the open-state content (the four stage
 * cards + the rubric matrix). They stay Server Components — only this
 * shell needs to be a Client Component for the toggle behavior.
 */
export function FullPathwayDisclosure({
  defaultOpen = false,
  children,
}: FullPathwayDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const contentId = `${id}-content`;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: open ? "var(--ypp-purple-50)" : "var(--surface)",
          border: "1px solid var(--border)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "22px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          cursor: "pointer",
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "0.005em",
          color: open ? "var(--ypp-purple-800)" : "var(--text)",
          transition:
            "background var(--transition-base, 200ms ease), color var(--transition-base, 200ms ease)",
        }}
        onMouseOver={(e) => {
          if (!open)
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--ypp-purple-50)";
        }}
        onMouseOut={(e) => {
          if (!open)
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--surface)";
        }}
      >
        <span>{open ? "Hide the full pathway" : "See the full pathway"}</span>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--transition-base, 200ms ease)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ↓
        </span>
      </button>

      <div
        id={contentId}
        hidden={!open}
        style={{
          padding: open ? "32px 0 8px" : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
