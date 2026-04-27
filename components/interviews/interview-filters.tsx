import Link from "next/link";
import type {
  InterviewHubFilters,
  InterviewHubKpis,
  InterviewScope,
  InterviewStateFilter,
  InterviewView,
} from "@/lib/interviews/types";

type InterviewFiltersProps = {
  filters: InterviewHubFilters;
  canTeamView: boolean;
  kpis?: InterviewHubKpis;
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
  { value: "all", label: "All" },
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

function stateCount(value: InterviewStateFilter | "all", kpis?: InterviewHubKpis) {
  if (!kpis) return null;
  if (value === "needs_action") return kpis.needsAction;
  if (value === "scheduled") return kpis.scheduledTotal;
  if (value === "completed") return kpis.completedThisWeek;
  return null;
}

export default function InterviewFilters({ filters, canTeamView, kpis }: InterviewFiltersProps) {
  return (
    <div className="iv-card iv-card-body" aria-label="Filter interviews">
      <div className="iv-filter-row">
        <div>
          <p className="iv-filter-label">Scope</p>
          <div className="iv-segmented" role="group" aria-label="Interview scope">
            {SCOPES.map((scope) => {
              const selected = filters.scope === scope.value;
              return (
                <Link
                  key={scope.value}
                  href={makeHref(filters, { scope: scope.value })}
                  className={selected ? "is-selected" : ""}
                  aria-current={selected ? "page" : undefined}
                >
                  {scope.label}
                </Link>
              );
            })}
          </div>
        </div>

        {canTeamView ? (
          <div>
            <p className="iv-filter-label">View</p>
            <div className="iv-segmented" role="group" aria-label="Interview view">
              {VIEWS.map((view) => {
                const selected = filters.view === view.value;
                return (
                  <Link
                    key={view.value}
                    href={makeHref(filters, { view: view.value })}
                    className={selected ? "is-selected" : ""}
                    aria-current={selected ? "page" : undefined}
                  >
                    {view.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="iv-filter-row" style={{ marginTop: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="iv-filter-label">State</p>
          <div className="iv-filter-chip-group">
            {STATES.map((state) => {
              const selected = filters.state === state.value;
              const count = stateCount(state.value, kpis);
              return (
                <Link
                  key={state.value}
                  href={makeHref(filters, { state: state.value })}
                  className={`iv-filter-chip${selected ? " is-selected" : ""}`}
                  aria-current={selected ? "page" : undefined}
                >
                  {state.label}
                  {typeof count === "number" && count > 0 ? (
                    <span className="iv-filter-chip-count">{count}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
