import { CardV2, FilterBar, FilterChipLink, ViewSwitcher } from "@/components/ui-v2";
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
    <CardV2 padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Scope
          </p>
          <ViewSwitcher
            aria-label="Scope"
            views={SCOPES.map((scope) => ({
              key: scope.value,
              label: scope.label,
              href: makeHref(filters, { scope: scope.value }),
              active: filters.scope === scope.value,
            }))}
          />
        </div>
        {canTeamView ? (
          <div>
            <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              View
            </p>
            <ViewSwitcher
              aria-label="View"
              views={VIEWS.map((view) => ({
                key: view.value,
                label: view.label,
                href: makeHref(filters, { view: view.value }),
                active: filters.view === view.value,
              }))}
            />
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          State
        </p>
        <FilterBar aria-label="Interview state">
          {STATES.map((state) => {
            const count = stateCount(state.value, kpis);
            return (
              <FilterChipLink
                key={state.value}
                href={makeHref(filters, { state: state.value })}
                active={filters.state === state.value}
                count={typeof count === "number" && count > 0 ? count : undefined}
              >
                {state.label}
              </FilterChipLink>
            );
          })}
        </FilterBar>
      </div>
    </CardV2>
  );
}
