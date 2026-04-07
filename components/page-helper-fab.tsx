"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { resolvePageHelper } from "@/lib/page-helper/resolve";
import type { PageHelperRole } from "@/lib/page-helper/types";

type PageHelperFabProps = {
  primaryRole?: PageHelperRole | null;
  roles?: string[] | null;
};

export default function PageHelperFab({
  primaryRole,
  roles,
}: PageHelperFabProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelId = useId();

  const resolved = resolvePageHelper({
    pathname,
    primaryRole,
    roles,
  });

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    headingRef.current?.focus();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setIsOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!resolved || resolved.hidden) {
    return null;
  }

  return (
    <div
      className={`page-helper-root ${resolved.placement === "bottom-left" ? "left" : "right"}`}
      data-page-helper-pattern={resolved.pattern}
      data-page-helper-placement={resolved.placement}
    >
      {isOpen ? (
        <div
          ref={panelRef}
          id={panelId}
          className="page-helper-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${panelId}-title`}
        >
          <div className="page-helper-panel-header">
            <div>
              <p className="page-helper-kicker">Quick Help</p>
              <h2
                ref={headingRef}
                id={`${panelId}-title`}
                className="page-helper-title"
                tabIndex={-1}
              >
                {resolved.title}
              </h2>
            </div>
            <button
              type="button"
              className="page-helper-close"
              onClick={() => {
                setIsOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label="Close page help"
            >
              {"\u2715"}
            </button>
          </div>

          <div className="page-helper-body">
            <div>
              <p className="page-help-label">What this page is for</p>
              <p>{resolved.content.purpose}</p>
            </div>
            <div>
              <p className="page-help-label">What to do first</p>
              <p>{resolved.content.firstStep}</p>
            </div>
            <div>
              <p className="page-help-label">What happens next</p>
              <p>{resolved.content.nextStep}</p>
            </div>
          </div>
        </div>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        className="page-helper-toggle"
        aria-label={isOpen ? "Close page help" : "Open page help"}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        ?
      </button>
    </div>
  );
}
