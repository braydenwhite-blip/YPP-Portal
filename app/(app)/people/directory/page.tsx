import { redirect } from "next/navigation";

import { PeopleDirectory } from "@/components/people/people-directory";
import { PeopleHubNav } from "@/components/people/people-hub-nav";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import {
  PrimaryFocusCard,
  SimpleSurface,
  type SimpleAction,
} from "@/components/command-center/simple";
import {
  ButtonLink,
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  UrlSyncedSearchInput,
} from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
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
} from "@/lib/people/directory";
import { hasRole } from "@/lib/authorization";

export const dynamic = "force-dynamic";
export const metadata = { title: "People Directory — Pathways Portal" };

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
  return qs ? `/people/directory?${qs}` : "/people/directory";
}

export default async function PeopleDirectoryPage({
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
  const needsAttention = rows.filter((r) => r.flags.some((f) => f.tone === "danger"));

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
        ctaHref="/people/directory?flag=no-advisor"
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
        ctaHref="/people/directory?flag=checkin-overdue"
      />
    ) : (
      <PrimaryFocusCard
        eyebrow="People"
        title="Everyone has coverage."
        reason="Every student has an advisor and no check-ins are overdue."
        icon="check"
        tone="success"
        ctaLabel="Browse everyone"
        ctaHref="/people/directory?role=all"
      />
    );

  const strip: SimpleAction[] = [
    {
      label: "Needs attention",
      href: "/people/directory?flag=needs-attention",
      icon: "bolt",
      primary: needsAttention.length > 0,
    },
    { label: "Students", href: "/people/directory?role=student", icon: "users" },
    { label: "Instructors", href: "/people/directory?role=instructor", icon: "users" },
    { label: "Applicants", href: "/people/directory?role=applicant", icon: "user" },
  ];

  const tableBlock = (
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
    <SimpleSurface
      maxWidth={960}
      header={
        <>
          <PeopleHubNav showPerformance={hubAccess.showPerformance} />

          <PageHeaderV2
            title="People"
            subtitle="Who owns what — search by name or email, then scan the roster table."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {canUseAdminPeopleTools ? (
                  <ButtonLink href="/people/find" variant="secondary" size="sm">
                    Find or add person
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
        </>
      }
      focus={focus}
      actions={strip}
      aboveBrowse={tableBlock}
      browseLabel="Coverage stats"
      browseHint="Quick counts for advisors, check-ins, and caseloads."
    >
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        <li className="rounded-[12px] border border-line-soft bg-surface-soft px-4 py-3 text-[13px] text-ink">
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            Students without advisor
          </span>
          <span className="text-[20px] font-bold text-ink">{stats.studentsWithoutAdvisor}</span>
        </li>
        <li className="rounded-[12px] border border-line-soft bg-surface-soft px-4 py-3 text-[13px] text-ink">
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            Check-ins overdue
          </span>
          <span className="text-[20px] font-bold text-ink">{stats.checkInsOverdue}</span>
        </li>
      </ul>
    </SimpleSurface>
  );
}
