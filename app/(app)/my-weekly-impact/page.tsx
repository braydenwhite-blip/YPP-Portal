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

const FLOW_STEPS: Array<{ n: number; title: string; body: string }> = [
  {
    n: 1,
    title: "Add your part",
    body: "Fill what you did, what you'll show, and what you need. It's pre-filled from your live work.",
  },
  {
    n: 2,
    title: "It joins your team's one presentation",
    body: "Everyone's parts combine into a single presentation per team — not one per person.",
  },
  {
    n: 3,
    title: "Your team presents once",
    body: "Leadership runs the weekly Impact Meeting from each team's combined presentation.",
  },
];

function FlowExplainer() {
  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-3">
      {FLOW_STEPS.map((step) => (
        <li
          key={step.n}
          className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">
              {step.n}
            </span>
            <span className="text-sm font-bold text-ink">{step.title}</span>
          </div>
          <p className="m-0 text-[12.5px] leading-relaxed text-ink-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  );
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

  const teamCount = data.forms.length;
  const roleLabel = (session.primaryRole ?? "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5 pb-10">
      <PageHeaderV2
        eyebrow="Weekly Impact"
        title="My Weekly Impact"
        subtitle={`Week of ${data.weekKey} · ${data.initiativeTitle}. Add your part to your team's one weekly presentation — what you did, what you'll show, and what you need.`}
      />

      <FlowExplainer />

      {teamCount > 1 ? (
        <p className="m-0 text-[12.5px] text-ink-muted">
          You contribute to {teamCount} teams — there&apos;s one section below for each. Each one
          feeds that team&apos;s single presentation.
        </p>
      ) : null}

      {data.forms.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-ink-muted">
          You&apos;re not on an Impact team&apos;s weekly presentation yet. Pick your team below to
          add your part — it&apos;ll pre-fill from your tracked work.
        </div>
      ) : (
        data.forms.map((team) => (
          <MyWeeklyImpactForm key={team.briefId} team={team} roleLabel={roleLabel || undefined} />
        ))
      )}

      {data.joinableTeams.length ? (
        <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="m-0 text-base font-bold text-ink">
            {data.forms.length === 0 ? "Pick your team" : "Also contribute to another team"}
          </h2>
          <p className="m-0 mt-1 text-sm text-ink-muted">
            Add your part to another team&apos;s weekly presentation.
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
