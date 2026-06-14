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

  const { rows, total, advisorFilter } = await loadPeopleDirectory({
    q,
    role,
    flag,
    advisorId,
  });

  const usingFlag = Boolean(flag);
  const usingRole = role !== "all" && !usingFlag;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
      <PeopleHubNav
        active="directory"
        showPerformance={hubAccess.showPerformance}
        showClasses={hubAccess.showClasses}
      />

      <PageHeaderV2
        title="People"
        subtitle="Search by name or email, then open someone."
        actions={
          canUseAdminPeopleTools ? (
            <ButtonLink href="/admin/bulk-users" variant="secondary" size="md">
              Add person
            </ButtonLink>
          ) : null
        }
      />

      <UrlSyncedSearchInput
        placeholder="Search name or email…"
        wrapClassName="w-full"
        aria-label="Search people"
      />

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
}
