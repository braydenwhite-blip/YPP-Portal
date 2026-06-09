import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled, isOperationsHubEnabled } from "@/lib/feature-flags";
import { getWeeklyReviewForViewer } from "@/lib/people-strategy/operational-digest-queries";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import {
  ActionUrgencyList,
  DecisionFollowThroughCard,
  EmptyCard,
  EntityHealthList,
  MeetingFollowThroughCard,
} from "@/components/people-strategy/command-center-os";
import {
  nextReviewDate,
  resolveWeeklyReviewStep,
  WeeklyReviewNav,
  WeeklyReviewStepper,
  WeeklyReviewStepShell,
  WeeklyReviewWrapUp,
  type WeeklyReviewStepKey,
} from "@/components/people-strategy/weekly-review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly Review · Operations" };

function TriageGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 className="ps-section-title" style={{ margin: 0, fontSize: 14 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * Weekly Leadership Review — a guided, deterministic pass over the same weekly
 * digest the Command Center shows. The active step lives in `?step=`; there is
 * no persisted review session this pass (kept deliberately simple, no migration),
 * and every action links into an existing tracker / meeting flow — nothing here
 * invents an unsupported mutation. Officer-gated + double-flagged.
 */
export default async function WeeklyReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string }>;
}) {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const sp = (await searchParams) ?? {};
  const step = resolveWeeklyReviewStep(sp.step);

  const { digest, triage } = await getWeeklyReviewForViewer(viewer, { now });
  const healthEntities = [...digest.criticalEntities, ...digest.staleEntities];

  const triageIds = new Set(
    [...triage.overdue, ...triage.blocked, ...triage.unassigned, ...triage.dueSoon].map((a) => a.id)
  );
  const counts: Partial<Record<WeeklyReviewStepKey, number>> = {
    triage: triageIds.size,
    meetings: digest.meetingsNeedingFollowThrough.length,
    entities: healthEntities.length,
    decisions: digest.decisionsNeedingAction.length,
  };

  return (
    <div className="page-shell" style={{ maxWidth: 980 }}>
      <ActionCommandBar
        eyebrow="People Strategy · Leadership"
        title="Weekly Review"
        subtitle="A guided pass through what needs a decision this week — work the steps in order."
        actions={
          <Link href="/operations/command-center" className="button outline small">
            Command Center
          </Link>
        }
      />

      <div style={{ marginTop: 16 }}>
        <WeeklyReviewStepper activeKey={step} counts={counts} />
      </div>

      <div style={{ marginTop: 22 }}>
        {step === "triage" ? (
          <WeeklyReviewStepShell stepKey="triage">
            <TriageGroup title={`Overdue (${triage.overdue.length})`}>
              <ActionUrgencyList actions={triage.overdue} emptyHint="Nothing is overdue. 🎉" />
            </TriageGroup>
            <TriageGroup title={`Blocked (${triage.blocked.length})`}>
              <ActionUrgencyList actions={triage.blocked} emptyHint="Nothing is blocked right now." />
            </TriageGroup>
            <TriageGroup title={`Unowned (${triage.unassigned.length})`}>
              <ActionUrgencyList
                actions={triage.unassigned}
                emptyHint="Every open action has an owner. Open an action to assign or reassign it."
              />
            </TriageGroup>
            <TriageGroup title={`Due soon (${triage.dueSoon.length})`}>
              <ActionUrgencyList actions={triage.dueSoon} emptyHint="Nothing else is due this week." />
            </TriageGroup>
          </WeeklyReviewStepShell>
        ) : null}

        {step === "meetings" ? (
          <WeeklyReviewStepShell stepKey="meetings">
            {digest.meetingsNeedingFollowThrough.length === 0 ? (
              <EmptyCard>
                Every recent meeting has produced action or has no open follow-ups. Open the Meetings Tracker to
                schedule the next one.
              </EmptyCard>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {digest.meetingsNeedingFollowThrough.map((m) => (
                  <MeetingFollowThroughCard key={m.id} meeting={m} />
                ))}
              </div>
            )}
          </WeeklyReviewStepShell>
        ) : null}

        {step === "entities" ? (
          <WeeklyReviewStepShell stepKey="entities">
            <EntityHealthList
              entities={healthEntities}
              emptyHint="No part of YPP is critical or drifting right now. Nicely steady."
            />
          </WeeklyReviewStepShell>
        ) : null}

        {step === "decisions" ? (
          <WeeklyReviewStepShell stepKey="decisions">
            {digest.decisionsNeedingAction.length === 0 ? (
              <EmptyCard>Every recent decision has a linked action. Decisions are turning into execution. ✅</EmptyCard>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {digest.decisionsNeedingAction.map((d) => (
                  <DecisionFollowThroughCard key={d.id} decision={d} />
                ))}
              </div>
            )}
          </WeeklyReviewStepShell>
        ) : null}

        {step === "wrap" ? (
          <WeeklyReviewStepShell stepKey="wrap">
            <WeeklyReviewWrapUp
              digest={digest}
              triage={triage}
              nextReviewISO={nextReviewDate(now).toISOString()}
            />
          </WeeklyReviewStepShell>
        ) : null}

        <WeeklyReviewNav activeKey={step} />
      </div>
    </div>
  );
}
