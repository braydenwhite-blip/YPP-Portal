import { notFound } from "next/navigation";

import { MyWeeklyImpactForm } from "@/components/people-strategy/my-weekly-impact-form";
import { PageHeaderV2 } from "@/components/ui-v2";
import { requireSessionUser } from "@/lib/authorization";
import { isWeeklyTeamBriefsEnabled } from "@/lib/feature-flags";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID } from "@/lib/people-strategy/impact-meetings";
import { startMyWeeklyImpact } from "@/lib/people-strategy/weekly-team-brief-actions";
import { loadMyWeeklyImpact } from "@/lib/people-strategy/weekly-team-briefs";

export const dynamic = "force-dynamic";

async function joinTeam(formData: FormData) {
  "use server";
  await startMyWeeklyImpact({
    initiativeId: String(formData.get("initiativeId") ?? ""),
    workstreamId: String(formData.get("workstreamId") ?? ""),
  });
}

export default async function MyWeeklyImpactPage() {
  if (!isWeeklyTeamBriefsEnabled()) notFound();
  const session = await requireSessionUser().catch(() => null);
  if (!session) notFound();

  const viewer: ActionViewer = {
    id: session.id,
    roles: session.roles,
    primaryRole: session.primaryRole,
    adminSubtypes: session.adminSubtypes,
  };

  const data = await loadMyWeeklyImpact({
    initiativeId: GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
    viewer,
  });
  if (!data) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5 pb-10">
      <PageHeaderV2
        eyebrow="Weekly Impact"
        title="My Weekly Impact"
        subtitle={`Week of ${data.weekKey} · ${data.initiativeTitle}. Fill in what you did, what you'll show, and what you need — it's already pre-filled from your live work.`}
      />

      {data.forms.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-ink-muted">
          You&apos;re not on an Impact team&apos;s weekly form yet. Pick your team below to start
          this week&apos;s update — it&apos;ll pre-fill from your tracked work.
        </div>
      ) : (
        data.forms.map((team) => <MyWeeklyImpactForm key={team.briefId} team={team} />)
      )}

      {data.joinableTeams.length ? (
        <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="m-0 text-base font-bold text-ink">
            {data.forms.length === 0 ? "Pick your team" : "Also report for another team"}
          </h2>
          <p className="m-0 mt-1 text-sm text-ink-muted">
            Start a weekly form for a team you contribute to.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.joinableTeams.map((team) => (
              <form key={team.workstreamId} action={joinTeam}>
                <input type="hidden" name="initiativeId" value={data.initiativeId} />
                <input type="hidden" name="workstreamId" value={team.workstreamId} />
                <button
                  type="submit"
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-ink hover:border-brand-400"
                >
                  + {team.title}
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
