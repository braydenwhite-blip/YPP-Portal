import Link from "next/link";
import { CardV2, FilterBar, FilterChipLink, cn } from "@/components/ui-v2";
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

/** URL-synced segmented control — filters are links, not client state. */
function Segmented({
  label,
  options,
}: {
  label: string;
  options: Array<{ label: string; href: string; selected: boolean }>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </p>
      <div
        role="group"
        aria-label={label}
        className="inline-flex overflow-hidden rounded-[10px] border border-line bg-surface-soft p-0.5"
      >
        {options.map((option) => (
          <Link
            key={option.label}
            href={option.href}
            aria-current={option.selected ? "page" : undefined}
            className={cn(
              "rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
              option.selected
                ? "bg-surface text-brand-700 shadow-card"
                : "text-ink-muted hover:text-brand-700"
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function InterviewFilters({ filters, canTeamView, kpis }: InterviewFiltersProps) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-6">
        <Segmented
          label="Scope"
          options={SCOPES.map((scope) => ({
            label: scope.label,
            href: makeHref(filters, { scope: scope.value }),
            selected: filters.scope === scope.value,
          }))}
        />
        {canTeamView ? (
          <Segmented
            label="View"
            options={VIEWS.map((view) => ({
              label: view.label,
              href: makeHref(filters, { view: view.value }),
              selected: filters.view === view.value,
            }))}
          />
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
