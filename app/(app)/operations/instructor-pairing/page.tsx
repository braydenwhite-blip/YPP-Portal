import { notFound } from "next/navigation";
import { requireOfficer } from "@/lib/authorization";
import { getSessionUser } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { ButtonLink } from "@/components/ui-v2";
import { loadInstructorPairingCockpitData } from "@/lib/instructor-pairing/queries";
import type {
  PairingCard,
  PairingCardAction,
  PairingCockpit,
} from "@/lib/instructor-pairing/types";
import {
  actionPrefillToQuery,
  buildActionPrefillFromEntity,
} from "@/lib/people-strategy/action-prefill";
import { PairingCockpitClient } from "@/components/instructor-pairing/pairing-cockpit";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Instructor pairing cockpit",
};

/** Resolve the action-tracker links for coverage/training actions server-side,
 *  dropping them when the tracker is off so no dead link ever renders. */
function resolveActionHrefs(cockpit: PairingCockpit, trackerOn: boolean): PairingCockpit {
  const resolve = (card: PairingCard) => (action: PairingCardAction): PairingCardAction | null => {
    if (action.kind === "create_coverage_action") {
      if (!trackerOn) return null;
      if (card.offeringId) {
        return {
          ...action,
          href: actionPrefillToQuery(
            buildActionPrefillFromEntity({
              type: "CLASS_OFFERING",
              id: card.offeringId,
              actionType: "CLASS_PLANNING",
              title: `Coverage: ${card.title}`,
            }),
          ),
        };
      }
      if (card.partnerId) {
        return {
          ...action,
          href: actionPrefillToQuery(
            buildActionPrefillFromEntity({
              type: "PARTNER",
              id: card.partnerId,
              actionType: "PARTNERSHIP",
              title: `Partner coverage: ${card.partnerName ?? card.title}`,
            }),
          ),
        };
      }
      return null;
    }
    if (action.kind === "schedule_training") {
      if (!trackerOn || !action.instructorId) return null;
      return {
        ...action,
        href: actionPrefillToQuery(
          buildActionPrefillFromEntity({
            type: "USER",
            id: action.instructorId,
            actionType: "INSTRUCTOR_ONBOARDING",
            title: `Training & onboarding: ${card.instructorName ?? "instructor"}`,
          }),
        ),
      };
    }
    return action;
  };

  const fix = (card: PairingCard): PairingCard => {
    const r = resolve(card);
    const primary = r(card.primaryAction) ?? card.primaryAction;
    const secondary = card.secondaryActions
      .map(r)
      .filter((a): a is PairingCardAction => a !== null);
    return { ...card, primaryAction: primary, secondaryActions: secondary };
  };

  return { ...cockpit, lanes: cockpit.lanes.map((l) => ({ ...l, cards: l.cards.map(fix) })) };
}

export default async function InstructorPairingCockpitPage() {
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();
  const sessionUser = await getSessionUser();

  const now = new Date();
  const data = await loadInstructorPairingCockpitData(
    { id: viewer.id, roles: viewer.roles, chapterId: sessionUser?.chapterId ?? null },
    now,
  );
  const cockpit = resolveActionHrefs(data.cockpit, isActionTrackerEnabled());

  const headline =
    cockpit.totalSituations === 0
      ? "Coverage is in good shape — nothing needs pairing attention right now."
      : `${cockpit.totalSituations} coverage situation${cockpit.totalSituations === 1 ? "" : "s"} need attention.`;

  return (
    <div className="mx-auto w-full max-w-[1220px] px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-brand-600">
            Instructor pairing
          </p>
          <h1 className="mt-1 font-sans text-[26px] font-extrabold leading-tight text-ink">
            Pairing & coverage cockpit
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-muted">{headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/admin/instructor-assignments" variant="secondary" size="sm">
            Assignments board
          </ButtonLink>
          <ButtonLink href="/partners" variant="ghost" size="sm">
            Partners
          </ButtonLink>
        </div>
      </header>

      <PairingCockpitClient cockpit={cockpit} instructorPool={data.instructorPool} />
    </div>
  );
}
