import Link from "next/link";
import { redirect } from "next/navigation";

import { PeopleDirectory } from "@/components/people/people-directory";
import { PeopleHubNav } from "@/components/people/people-hub-nav";
import {
  ButtonLink,
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  UrlSyncedSearchInput,
} from "@/components/ui-v2";
import { CalmCollapse, CalmOnly, CommandModeToggle } from "@/components/command-center/command-mode";
import {
  EmptySimpleState,
  PrimaryFocusCard,
  SimpleActionStrip,
  SimpleListCard,
  SimpleRow,
  type SimpleAction,
} from "@/components/command-center/simple";
import { getSession } from "@/lib/auth-supabase";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import {
  asPeopleFlagFilter,
  asPeopleRoleFilter,
  loadPeopleDirectory,
  PEOPLE_FLAG_FILTER_LABELS,
  PEOPLE_ROLE_FILTER_LABELS,
  PEOPLE_SIMPLE_ROLE_FILTERS,
  type PersonDirectoryRow,
} from "@/lib/people/directory";
import { hasRole } from "@/lib/authorization";

export const dynamic = "force-dynamic";
export const metadata = { title: "People — Pathways Portal" };

function peopleHref(params: {
  role?: string;
  flag?: string;
  q?: string;
  advisor?: string;
}): string {
  const search = new URLSearchParams();
  if (params.role && params.role !== "all") search.set("role", params.role);
  if (params.flag) search.set("flag", params.flag);
  if (params.advisor) search.set("advisor", params.advisor);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `/people?${qs}` : "/people";
}

function dangerFlag(row: PersonDirectoryRow) {
  return row.flags.find((f) => f.tone === "danger") ?? row.flags[0] ?? null;
}

/** One person who needs attention: name · why · advisor / next check-in. */
function PersonRowSimple({ row }: { row: PersonDirectoryRow }) {
  const flag = dangerFlag(row);
  const checkIn = row.advisor?.nextCheckInISO
    ? `Check-in ${formatMonthDay(new Date(row.advisor.nextCheckInISO))}`
    : row.advisor
      ? `Advisor: ${row.advisor.name}`
      : null;
  return (
    <SimpleRow
      href={`/people/${row.id}`}
      name={row.name}
      what={row.affiliation ?? row.email}
      status={flag ? { label: flag.label, tone: flag.tone } : null}
      meta={checkIn}
    />
  );
}

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
  if (!isOfficerTier(viewer)) redirect("/");

  const canUseAdminPeopleTools = hasRole(viewer.roles, "ADMIN", viewer.primaryRole);
  const hubAccess = getPeopleHubAccess(viewer);

  const sp = await searchParams;
  const role = asPeopleRoleFilter(typeof sp.role === "string" ? sp.role : undefined);
  const flag = asPeopleFlagFilter(typeof sp.flag === "string" ? sp.flag : undefined);
  const advisorId = typeof sp.advisor === "string" ? sp.advisor : null;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const { rows, total, stats, advisorFilter } = await loadPeopleDirectory({
    q,
    role,
    flag,
    advisorId,
  });

  const usingFlag = Boolean(flag);
  const usingRole = role !== "all" && !usingFlag;
  // When the officer is actively searching or filtering, the directory is the
  // answer — show it inline. On the plain landing, lead with who needs attention
  // and tuck the full directory behind "Browse everyone".
  const browsing = Boolean(q) || usingFlag || usingRole || Boolean(advisorFilter);

  const needsAttention = rows.filter((r) => r.flags.some((f) => f.tone === "danger"));

  // The one obvious lead: the biggest coverage gap.
  const focus =
    stats.studentsWithoutAdvisor > 0 ? (
      <PrimaryFocusCard
        eyebrow="Needs attention"
        title={`${stats.studentsWithoutAdvisor} student${
          stats.studentsWithoutAdvisor === 1 ? "" : "s"
        } without an advisor`}
        reason="Assign an advisor so each student has a clear point of contact."
        icon="user"
        ctaLabel="See who"
        ctaHref="/people?flag=no-advisor"
      />
    ) : stats.checkInsOverdue > 0 ? (
      <PrimaryFocusCard
        eyebrow="Needs attention"
        title={`${stats.checkInsOverdue} check-in${
          stats.checkInsOverdue === 1 ? "" : "s"
        } overdue`}
        reason="These advisees are past their next scheduled check-in."
        icon="clock"
        ctaLabel="See who"
        ctaHref="/people?flag=checkin-overdue"
      />
    ) : (
      <PrimaryFocusCard
        eyebrow="People"
        title="Everyone has coverage."
        reason="Every student has an advisor and no check-ins are overdue. Search to find anyone."
        icon="check"
        tone="success"
        ctaLabel="Browse everyone"
        ctaHref="/people?role=all"
      />
    );

  const strip: SimpleAction[] = [
    {
      label: "Needs attention",
      href: "/people?flag=needs-attention",
      icon: "bolt",
      primary: needsAttention.length > 0,
    },
    { label: "Students", href: "/people?role=student", icon: "users" },
    { label: "Instructors", href: "/people?role=instructor", icon: "users" },
  ];

  const directory = (
    <div className="flex flex-col gap-4">
      <FilterBar aria-label="People views">
        {PEOPLE_SIMPLE_ROLE_FILTERS.map((value) => (
          <FilterChipLink
            key={value}
            href={peopleHref({ role: value, q })}
            active={usingRole && role === value}
          >
            {PEOPLE_ROLE_FILTER_LABELS[value]}
          </FilterChipLink>
        ))}
        <FilterChipLink
          href={peopleHref({ flag: "needs-attention", q })}
          active={flag === "needs-attention"}
        >
          {PEOPLE_FLAG_FILTER_LABELS["needs-attention"]}
        </FilterChipLink>
        {advisorFilter ? (
          <FilterChipLink href={peopleHref({ role, q })} active>
            Caseload: {advisorFilter.name} ✕
          </FilterChipLink>
        ) : null}
      </FilterBar>

      <p className="m-0 text-[12.5px] text-ink-muted">
        {rows.length === total
          ? `${total} ${total === 1 ? "person" : "people"}`
          : `${rows.length} of ${total}`}
        {q ? ` · “${q}”` : ""}
      </p>

      <PeopleDirectory rows={rows} />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 pb-10">
      <PeopleHubNav
        active="directory"
        showPerformance={hubAccess.showPerformance}
        showClasses={hubAccess.showClasses}
      />

      <PageHeaderV2
        title="People"
        subtitle="Who owns what. Search by name or email."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canUseAdminPeopleTools ? (
              <ButtonLink href="/admin/bulk-users" variant="secondary" size="sm">
                Add person
              </ButtonLink>
            ) : null}
            <CommandModeToggle />
          </div>
        }
      />

      <UrlSyncedSearchInput
        placeholder="Search name or email…"
        wrapClassName="w-full"
        aria-label="Search people"
      />

      {browsing ? (
        directory
      ) : (
        <>
          {focus}
          <CalmOnly>
            <SimpleListCard
              title="Who needs attention"
              action={
                needsAttention.length > 5 ? (
                  <Link
                    href="/people?flag=needs-attention"
                    className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
                  >
                    View all ({needsAttention.length}) →
                  </Link>
                ) : undefined
              }
              empty={
                needsAttention.length === 0 ? (
                  <EmptySimpleState>
                    No one is flagged — every student has an advisor and check-ins are current.
                  </EmptySimpleState>
                ) : undefined
              }
            >
              {needsAttention.slice(0, 5).map((row) => (
                <PersonRowSimple key={row.id} row={row} />
              ))}
            </SimpleListCard>
          </CalmOnly>

          <SimpleActionStrip actions={strip} />

          <CalmCollapse
            label="Browse everyone"
            hint="The full directory, with role and attention filters."
          >
            {directory}
          </CalmCollapse>
        </>
      )}
    </div>
  );
}
