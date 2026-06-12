import { redirect } from "next/navigation";

import { PartnerDirectory } from "@/components/partners/partner-directory";
import {
  ButtonLink,
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  StatCardV2,
  UrlSyncedSearchInput,
} from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { hasRole } from "@/lib/authorization";
import {
  asPartnerFlagFilter,
  asPartnerViewFilter,
  filterPartnerRows,
  loadPartnerDirectory,
  PARTNER_FLAG_FILTER_LABELS,
  PARTNER_VIEW_FILTER_LABELS,
  PARTNER_VIEW_FILTERS,
} from "@/lib/partners-directory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partners — Pathways Portal",
};

function partnersHref(params: {
  view?: string;
  flag?: string;
  type?: string;
  q?: string;
}): string {
  const search = new URLSearchParams();
  if (params.view && params.view !== "all") search.set("view", params.view);
  if (params.flag) search.set("flag", params.flag);
  if (params.type) search.set("type", params.type);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `/partners?${qs}` : "/partners";
}

/**
 * Master Partner database (Knowledge OS V2 must-build, plan §10) — the
 * relationship-operations front door, promoted from the flag-gated admin
 * table. Who owns each relationship, who we talk to, what's linked, when we
 * last talked, what they've asked for, and what happens next. Rows open the
 * Partner 360 preview; the full profile (notes, pipeline editing, contacts &
 * requests management) stays one click away at /admin/partners/[id].
 */
export default async function PartnersPage({
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
  // Partner relationships are an operations surface: officer-tier and above
  // (mirrors the partner Entity 360 loader).
  if (!isOfficerTier(viewer)) redirect("/");
  const canManagePartners = hasRole(viewer.roles, "ADMIN", viewer.primaryRole);

  const sp = await searchParams;
  const view = asPartnerViewFilter(typeof sp.view === "string" ? sp.view : undefined);
  const flag = asPartnerFlagFilter(typeof sp.flag === "string" ? sp.flag : undefined);
  const type = typeof sp.type === "string" ? sp.type : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const { rows, stats, typeLabels } = await loadPartnerDirectory();
  const filtered = filterPartnerRows(rows, { view, flag, type, q });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <PageHeaderV2
        eyebrow="Knowledge OS"
        title="Partners"
        subtitle="Every organization YPP works with — who owns the relationship, what they've asked for, what's linked, and the next step so nothing goes cold."
        actions={
          canManagePartners ? (
            <>
              <ButtonLink href="/admin/partners/report" variant="ghost" size="md">
                Report
              </ButtonLink>
              <ButtonLink href="/admin/partners" variant="secondary" size="md">
                Add partner
              </ButtonLink>
            </>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-3">
          <StatCardV2
            label="Partners"
            value={stats.total}
            href={partnersHref({})}
          />
          <StatCardV2
            label="Active conversations"
            value={stats.activeConversations}
            href={partnersHref({ view: "active" })}
          />
          <StatCardV2
            label="Needs follow-up"
            value={stats.needsFollowUp}
            detail="overdue, no next step, or unowned"
            tone={stats.needsFollowUp > 0 ? "attention" : "default"}
            href={partnersHref({ view: "follow-up" })}
          />
          <StatCardV2
            label="Open requests"
            value={stats.openRequests}
            detail="asks being negotiated"
            tone={stats.openRequests > 0 ? "attention" : "default"}
            href={partnersHref({ flag: "open-requests" })}
          />
          <StatCardV2
            label="Upcoming meetings"
            value={stats.upcomingMeetings}
            detail="partners with a meeting scheduled"
            href={partnersHref({ view: "meetings" })}
          />
        </div>
      </PageHeaderV2>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar aria-label="Partner views">
          {PARTNER_VIEW_FILTERS.map((value) => (
            <FilterChipLink
              key={value}
              href={partnersHref({ view: value, type, q })}
              active={view === value && !flag}
            >
              {PARTNER_VIEW_FILTER_LABELS[value]}
            </FilterChipLink>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          <FilterChipLink
            href={partnersHref({ flag: "no-lead", q })}
            active={flag === "no-lead"}
          >
            {PARTNER_FLAG_FILTER_LABELS["no-lead"]}
          </FilterChipLink>
          <FilterChipLink
            href={partnersHref({ flag: "open-requests", q })}
            active={flag === "open-requests"}
          >
            {PARTNER_FLAG_FILTER_LABELS["open-requests"]}
          </FilterChipLink>
        </FilterBar>
        <UrlSyncedSearchInput
          placeholder="Search partners, contacts, leads…"
          wrapClassName="w-full sm:w-72"
          aria-label="Search partners"
        />
      </div>

      {typeLabels.length > 1 ? (
        <FilterBar aria-label="Partner types" className="-mt-2">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Type
          </span>
          {typeLabels.map((label) => (
            <FilterChipLink
              key={label}
              href={partnersHref({ view, flag: flag ?? undefined, q, type: type === label ? undefined : label })}
              active={type === label}
            >
              {label}
            </FilterChipLink>
          ))}
        </FilterBar>
      ) : null}

      <p className="m-0 text-[12.5px] text-ink-muted">
        {filtered.length === rows.length
          ? `${rows.length} partner${rows.length === 1 ? "" : "s"}`
          : `${filtered.length} of ${rows.length} partners`}
        {q ? ` · matching “${q}”` : ""}
      </p>

      <PartnerDirectory
        rows={filtered}
        actionTrackerEnabled={isActionTrackerEnabled()}
        canManagePartners={canManagePartners}
      />
    </div>
  );
}
