import Link from "next/link";
import type { CSSProperties } from "react";
import type { InterviewHubFilters, InterviewScope, InterviewStateFilter, InterviewView } from "@/lib/interviews/types";

type InterviewFiltersProps = {
  filters: InterviewHubFilters;
  canTeamView: boolean;
};

const SCOPES: Array<{ value: InterviewScope; label: string }> = [
  { value: "all", label: "All" },
  { value: "hiring", label: "Hiring" },
  { value: "readiness", label: "Readiness" },
];

const VIEWS: Array<{ value: InterviewView; label: string }> = [
  { value: "mine", label: "Mine" },
  { value: "team", label: "Team" },
];

const STATES: Array<{ value: InterviewStateFilter | "all"; label: string }> = [
  { value: "all", label: "All States" },
  { value: "needs_action", label: "Needs Action" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
];

function makeHref(filters: InterviewHubFilters, partial: Partial<InterviewHubFilters>) {
  const next = {
    ...filters,
    ...partial,
  };
  const query = new URLSearchParams({
    scope: next.scope,
    view: next.view,
    state: next.state,
  });
  return `/interviews?${query.toString()}`;
}

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    border: `1px solid ${active ? "#7c3aed" : "var(--border)"}`,
    background: active ? "#f5f3ff" : "transparent",
    color: active ? "#7c3aed" : "var(--muted)",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
  };
}

export default function InterviewFilters({ filters, canTeamView }: InterviewFiltersProps) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
            Scope
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SCOPES.map((scope) => (
              <Link
                key={scope.value}
                href={makeHref(filters, { scope: scope.value })}
                style={pillStyle(filters.scope === scope.value)}
              >
                {scope.label}
              </Link>
            ))}
          </div>
        </div>

        {canTeamView ? (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
              View
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {VIEWS.map((view) => (
                <Link
                  key={view.value}
                  href={makeHref(filters, { view: view.value })}
                  style={pillStyle(filters.view === view.value)}
                >
                  {view.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
            State
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATES.map((state) => (
              <Link
                key={state.value}
                href={makeHref(filters, { state: state.value })}
                style={pillStyle(filters.state === state.value)}
              >
                {state.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
