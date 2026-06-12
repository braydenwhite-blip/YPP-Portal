"use client";

/**
 * Zone 1 from §12.5.1 — the risks-and-considerations manifest in the
 * cockpit's right rail. Groups warnings by severity, expands HIGH_RISK by
 * default, and lets the chair acknowledge HIGH_RISK warnings in-place so
 * the dock preview line and confirm modal stay in sync.
 */

import { useMemo, useState } from "react";
import {
  type FinalReviewWarning,
  type WarningSeverity,
  groupBySeverity,
} from "@/lib/final-review-warnings";
import { AlertOctagonIcon, AlertTriangleIcon, CheckIcon } from "./cockpit-icons";

const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  HIGH_RISK: "High risk",
  CAUTION: "Caution",
  INFO: "Considerations",
};

const SEVERITY_CLASS: Record<WarningSeverity, string> = {
  HIGH_RISK: "bg-rose-500/10 text-rose-700",
  CAUTION: "bg-amber-500/10 text-amber-700",
  INFO: "bg-brand-600/10 text-brand-700",
};

export interface RisksPanelProps {
  warnings: FinalReviewWarning[];
  acknowledgements: Record<string, boolean>;
  onToggleAcknowledge: (key: string) => void;
}

export default function RisksPanel({
  warnings,
  acknowledgements,
  onToggleAcknowledge,
}: RisksPanelProps) {
  const grouped = useMemo(() => groupBySeverity(warnings), [warnings]);
  const [expanded, setExpanded] = useState<Record<WarningSeverity, boolean>>({
    HIGH_RISK: true,
    CAUTION: false,
    INFO: false,
  });

  function toggleGroup(sev: WarningSeverity) {
    setExpanded((prev) => ({ ...prev, [sev]: !prev[sev] }));
  }

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[16px] border border-line bg-surface p-4 text-[13px] text-ink-muted shadow-card">
        <span className="inline-flex text-success-600">
          <CheckIcon size={16} />
        </span>
        No risks or considerations detected.
      </div>
    );
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-[16px] border border-line bg-surface p-4 shadow-card"
      aria-label="Risks and considerations"
    >
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        Risks &amp; considerations
      </p>
      {(["HIGH_RISK", "CAUTION", "INFO"] as WarningSeverity[]).map((sev) => {
        const items = grouped[sev];
        if (items.length === 0) return null;
        const isOpen = expanded[sev];
        return (
          <div key={sev}>
            <button
              type="button"
              onClick={() => toggleGroup(sev)}
              aria-expanded={isOpen}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-[8px] border border-transparent px-2 py-1.5 text-[12px] font-semibold uppercase tracking-[0.04em] ${SEVERITY_CLASS[sev]}`}
            >
              {sev === "HIGH_RISK" ? (
                <AlertOctagonIcon size={14} />
              ) : sev === "CAUTION" ? (
                <AlertTriangleIcon size={14} />
              ) : (
                <CheckIcon size={14} />
              )}
              <span className="flex-1 text-left">
                {items.length} {SEVERITY_LABEL[sev]}
              </span>
              <span className="text-[11px] font-medium">{isOpen ? "Hide" : "Show"}</span>
            </button>
            {isOpen ? (
              <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                {items.map((warning) => {
                  const acked = acknowledgements[warning.key] === true;
                  return (
                    <li
                      key={warning.key}
                      className="rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2"
                    >
                      <p className="m-0 text-[12px] font-semibold text-ink">
                        {warning.message}
                      </p>
                      {warning.detail ? (
                        <p className="m-0 mt-1 text-[11px] text-ink-muted">
                          {warning.detail}
                        </p>
                      ) : null}
                      {sev === "HIGH_RISK" ? (
                        <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-ink">
                          <input
                            type="checkbox"
                            checked={acked}
                            onChange={() => onToggleAcknowledge(warning.key)}
                          />
                          I&apos;ve reviewed this risk
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
