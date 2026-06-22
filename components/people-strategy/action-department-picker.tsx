"use client";

import { useMemo, type CSSProperties } from "react";

import { cn } from "@/components/ui-v2/cn";
import {
  groupActionDepartments,
  type ActionDepartmentOption,
} from "@/lib/people-strategy/action-departments";

const DEPT_CHIP_COLORS: Record<string, string> = {
  instruction: "#6b21c8",
  "recruitment-hiring": "#7c3aed",
  mentorship: "#0891b2",
  partnerships: "#0e9f6e",
  operations: "#2563eb",
  chapters: "#d97706",
  tech: "#4f46e5",
  communications: "#db2777",
  "social-media": "#e11d48",
  fundraising: "#059669",
  officers: "#475569",
  board: "#1e293b",
};

function chipStyle(slug: string | null, active: boolean): CSSProperties {
  const color = (slug && DEPT_CHIP_COLORS[slug]) || "#6b21c8";
  if (active) {
    return {
      borderColor: color,
      background: color,
      color: "#fff",
      boxShadow: `0 4px 14px ${color}40`,
    };
  }
  return {
    borderColor: `${color}55`,
    background: `${color}10`,
    color: "#3a3a52",
  };
}

/**
 * One-tap department tagging for Action Tracker forms — grouped chips instead of
 * a buried dropdown.
 */
export function ActionDepartmentPicker({
  id,
  label = "Team / department",
  hint = "Tag which team owns this work — chapters, tech, comms, officers, board, etc.",
  departments,
  value,
  onChange,
  allowEmpty = true,
  required = false,
  compact = false,
}: {
  id?: string;
  label?: string;
  hint?: string;
  departments: ActionDepartmentOption[];
  value: string;
  onChange: (departmentId: string) => void;
  allowEmpty?: boolean;
  required?: boolean;
  /** Tighter layout for inline quick-create forms. */
  compact?: boolean;
}) {
  const grouped = useMemo(() => groupActionDepartments(departments), [departments]);

  if (departments.length === 0) return null;

  return (
    <div className="ps-field" id={id}>
      <span className="ps-label">
        {label}
        {required ? <span className="ps-required"> *</span> : null}
      </span>
      {hint ? (
        <p className={cn("m-0 text-[12.5px] text-ink-muted", compact ? "mb-2" : "mb-2.5")}>{hint}</p>
      ) : null}

      <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-3.5")}>
        {grouped.map(({ key, label: groupLabel, items }) => (
          <div key={key}>
            <p className="m-0 mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              {groupLabel}
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={groupLabel}>
              {items.map((department) => {
                const active = value === department.id;
                return (
                  <button
                    key={department.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange(active && allowEmpty ? "" : department.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
                      active ? "scale-[1.02]" : "hover:-translate-y-px hover:shadow-sm"
                    )}
                    style={chipStyle(department.slug, active)}
                  >
                    {department.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {allowEmpty ? (
          <button
            type="button"
            aria-pressed={!value}
            onClick={() => onChange("")}
            className={cn(
              "self-start rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              !value
                ? "border-line-strong bg-surface-muted text-ink"
                : "border-line-soft bg-surface text-ink-muted hover:border-line hover:text-ink"
            )}
          >
            No team yet
          </button>
        ) : null}
      </div>
    </div>
  );
}
