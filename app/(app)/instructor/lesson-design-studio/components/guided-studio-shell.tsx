"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  getStudioExitDestination,
  type StudioEntryContext,
  type StudioPhase,
} from "@/lib/lesson-design-studio";
import { StudioPageNav } from "./studio-page-nav";

interface GuidedStudioShellProps {
  /** Curriculum draft title shown in the sticky toolbar. */
  curriculumTitle: string;
  draftId: string;
  entryContext: StudioEntryContext;
  activePhase: StudioPhase;
  statusLabel: string;
  statusClassName: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  updatedAtLabel: string;
  workflowNotice?: string | null;
  readOnlyNotice?: string | null;
  readOnlyBody?: string | null;
  toast?:
    | {
        kind: "error" | "success";
        message: string;
      }
    | null;
  toolbarActions?: ReactNode;
  heroActions?: ReactNode;
  children: ReactNode;
  /** Modals and fixed overlays — must not live inside the animated editor stage (transform breaks `position: fixed`). */
  globalOverlays?: ReactNode;
}

function getSaveIndicator(saveStatus: GuidedStudioShellProps["saveStatus"]) {
  switch (saveStatus) {
    case "saving":
      return {
        tone: "saving",
        label: "Saving…",
        detail: "",
      };
    case "saved":
      return {
        tone: "saved",
        label: "Saved",
        detail: "",
      };
    case "error":
      return {
        tone: "error",
        label: "Save failed",
        detail: "Retry or refresh.",
      };
    default:
      return {
        tone: "idle",
        label: "Autosave",
        detail: "",
      };
  }
}

export function GuidedStudioShell({
  curriculumTitle,
  draftId,
  entryContext,
  activePhase,
  statusLabel,
  statusClassName,
  saveStatus,
  updatedAtLabel,
  workflowNotice,
  readOnlyNotice,
  readOnlyBody,
  toast,
  toolbarActions,
  heroActions,
  children,
  globalOverlays,
}: GuidedStudioShellProps) {
  const saveIndicator = getSaveIndicator(saveStatus);
  const exitDestination = getStudioExitDestination(entryContext);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 12);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="cbs-studio lds-shell lds-guided-shell">
      {toast ? (
        <section
          className={`lds-studio-toast${toast.kind === "error" ? " error" : ""}`}
          role="alert"
        >
          {toast.message}
        </section>
      ) : null}

      <section className={`lds-studio-toolbar${isScrolled ? " scrolled" : ""}`}>
        <div className="lds-studio-toolbar-main lds-studio-toolbar-main--simple">
          <div className="lds-toolbar-region lds-toolbar-region-left">
            <Link href={exitDestination.href} className="studio-back-link">
              ← {exitDestination.label}
            </Link>
            <div className="lds-toolbar-brand">
              <span className="lds-toolbar-brand-mark" aria-hidden="true" />
              <div className="lds-toolbar-brand-copy">
                <strong className="lds-toolbar-curriculum-title">{curriculumTitle}</strong>
              </div>
            </div>
          </div>

          <div className="lds-toolbar-region lds-toolbar-region-right">
            <div className="lds-toolbar-meta-cluster">
              <div className="lds-toolbar-meta-row lds-toolbar-meta-row--primary">
                {toolbarActions ? (
                  <div className="lds-toolbar-actions">{toolbarActions}</div>
                ) : null}
                <div
                  className={`lds-save-indicator ${saveIndicator.tone}`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="lds-save-indicator-dot" aria-hidden="true" />
                  <div>
                    <strong>{saveIndicator.label}</strong>
                    {saveIndicator.detail ? (
                      <small>{saveIndicator.detail}</small>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="lds-toolbar-meta-row lds-toolbar-meta-row--secondary">
                <span className={statusClassName}>{statusLabel}</span>
                <span className="lds-updated-at">{updatedAtLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lds-guided-workbench lds-guided-workbench--single">
        <div className="lds-guided-main lds-guided-main--full">
          <div className="lds-guided-top-row">
            <StudioPageNav
              draftId={draftId}
              entryContext={entryContext}
              activePhase={activePhase}
            />
            {heroActions ? (
              <div className="lds-guided-top-row-actions">{heroActions}</div>
            ) : null}
          </div>

          {workflowNotice ? (
            <section className="card lds-readonly-banner lds-readonly-banner--compact" role="status">
              <p>{workflowNotice}</p>
            </section>
          ) : null}

          {readOnlyNotice && readOnlyBody ? (
            <section className="card lds-readonly-banner lds-readonly-banner--compact">
              <p>
                <strong>{readOnlyNotice}</strong> {readOnlyBody}
              </p>
            </section>
          ) : null}

          <div className="lds-guided-editor">
            <div key={activePhase} className="lds-guided-editor-stage">
              {children}
            </div>
          </div>
        </div>
      </div>

      {globalOverlays ? (
        <div className="lds-studio-global-overlays">{globalOverlays}</div>
      ) : null}
    </div>
  );
}
