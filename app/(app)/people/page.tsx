import { redirect } from "next/navigation";

import { PeopleDirectory } from "@/components/people/people-directory";
import {
  ButtonLink,
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  StatCardV2,
  UrlSyncedSearchInput,
} from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  asPeopleFlagFilter,
  asPeopleRoleFilter,
  loadPeopleDirectory,
  PEOPLE_FLAG_FILTER_LABELS,
  PEOPLE_ROLE_FILTER_LABELS,
  PEOPLE_ROLE_FILTERS,
} from "@/lib/people/directory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "People — Pathways Portal",
};

function peopleHref(params: { role?: string; flag?: string; q?: string }): string {
  const search = new URLSearchParams();
  if (params.role && params.role !== "all") search.set("role", params.role);
  if (params.flag) search.set("flag", params.flag);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `/people?${qs}` : "/people";
}

/**
 * Master People database (Knowledge OS V2 must-build, plan §9) — one
 * directory for every person connected to YPP: students, instructors,
 * mentors, advisors, applicants, leadership, parents. Search + filters +
 * concrete flags at the row level; clicking a row opens the Entity 360
 * preview; the full profile is one explicit click from there.
 *
 * (Replaces the legacy redirect to /actions/people — that dashboard remains
 * reachable directly and folds into the Work Hub in a later phase.)
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  // Advisor check-in state and applicant stages are leadership reads — the
  // directory is officer-tier and above (mirrors the operations surfaces).
  if (!isOfficerTier(viewer)) redirect("/");

  const sp = await searchParams;
  const role = asPeopleRoleFilter(typeof sp.role === "string" ? sp.role : undefined);
  const flag = asPeopleFlagFilter(typeof sp.flag === "string" ? sp.flag : undefined);
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const { rows, total, stats } = await loadPeopleDirectory({ q, role, flag });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <PageHeaderV2
        eyebrow="Knowledge OS"
        title="People"
        subtitle="Every person connected to YPP — find anyone, see their advisor or classes at a glance, and open their 360 without leaving the page."
        actions={
          <ButtonLink href="/admin/bulk-users" variant="secondary" size="md">
            Add person
          </ButtonLink>
        }
      >
        {/* Click-to-filter stat strip — every count lands on its filtered view. */}
        <div className="flex flex-wrap gap-3">
          <StatCardV2
            label="Students"
            value={stats.students}
            href={peopleHref({ role: "student" })}
          />
          <StatCardV2
            label="Instructors"
            value={stats.instructors}
            href={peopleHref({ role: "instructor" })}
          />
          <StatCardV2
            label="Applicants in process"
            value={stats.applicantsInProcess}
            detail="awaiting a decision"
            href={peopleHref({ role: "applicant" })}
          />
          <StatCardV2
            label="No advisor"
            value={stats.studentsWithoutAdvisor}
            detail="students unassigned"
            tone={stats.studentsWithoutAdvisor > 0 ? "attention" : "default"}
            href={peopleHref({ flag: "no-advisor" })}
          />
          <StatCardV2
            label="Check-ins overdue"
            value={stats.checkInsOverdue}
            detail="advisor check-ins past due"
            tone={stats.checkInsOverdue > 0 ? "attention" : "default"}
            href={peopleHref({ flag: "checkin-overdue" })}
          />
        </div>
      </PageHeaderV2>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar aria-label="Role filters">
          {PEOPLE_ROLE_FILTERS.map((value) => (
            <FilterChipLink
              key={value}
              href={peopleHref({ role: value, q })}
              active={role === value && !flag}
            >
              {PEOPLE_ROLE_FILTER_LABELS[value]}
            </FilterChipLink>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          <FilterChipLink
            href={peopleHref({ flag: "no-advisor", q })}
            active={flag === "no-advisor"}
          >
            {PEOPLE_FLAG_FILTER_LABELS["no-advisor"]}
          </FilterChipLink>
          <FilterChipLink
            href={peopleHref({ flag: "checkin-overdue", q })}
            active={flag === "checkin-overdue"}
          >
            {PEOPLE_FLAG_FILTER_LABELS["checkin-overdue"]}
          </FilterChipLink>
        </FilterBar>
        <UrlSyncedSearchInput
          placeholder="Search by name or email…"
          wrapClassName="w-full sm:w-72"
          aria-label="Search people"
        />
      </div>

      <p className="m-0 text-[12.5px] text-ink-muted">
        {rows.length === total
          ? `${total} ${total === 1 ? "person" : "people"}`
          : `Showing ${rows.length} of ${total} — refine the search or filters to narrow down`}
        {q ? ` · matching “${q}”` : ""}
      </p>

      <PeopleDirectory rows={rows} />
    </div>
  );
}
