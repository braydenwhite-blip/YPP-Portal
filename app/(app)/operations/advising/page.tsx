import { notFound } from "next/navigation";
import { requireOfficer } from "@/lib/authorization";
import { getSessionUser } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { ButtonLink } from "@/components/ui-v2";
import { loadAdvisingCockpitData } from "@/lib/advising/queries";
import { parseAdvisingLane } from "@/lib/advising/cockpit";
import type { AdvisingCard, AdvisingCockpit } from "@/lib/advising/types";
import {
  actionPrefillToQuery,
  buildActionPrefillFromEntity,
} from "@/lib/people-strategy/action-prefill";
import { AdvisingCockpitClient } from "@/components/advising/advising-cockpit";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Advising command center",
};

/**
 * Resolve context-preserving "Create follow-up" links server-side (the action
 * prefill builder is server-leaning) and drop them when the action tracker is
 * off so the cockpit never shows a dead link.
 */
function resolveActionHrefs(cockpit: AdvisingCockpit, trackerOn: boolean): AdvisingCockpit {
  const fix = (card: AdvisingCard) => {
    const subjectId = card.studentId ?? card.advisorId;
    const subjectName = card.studentName ?? card.advisorName ?? card.title;
    const resolve = (action: typeof card.primaryAction) => {
      if (action.kind !== "create_advising_action") return action;
      if (!trackerOn || !subjectId) return null;
      const href = actionPrefillToQuery(
        buildActionPrefillFromEntity({
          type: "USER",
          id: subjectId,
          actionType: "FOLLOW_UP",
          title: `Advising follow-up: ${subjectName}`,
        }),
      );
      return { ...action, href };
    };
    const primary = resolve(card.primaryAction) ?? card.primaryAction;
    const secondary = card.secondaryActions
      .map(resolve)
      .filter((a): a is NonNullable<typeof a> => a !== null);
    return { ...card, primaryAction: primary, secondaryActions: secondary };
  };

  return {
    ...cockpit,
    lanes: cockpit.lanes.map((lane) => ({ ...lane, cards: lane.cards.map(fix) })),
  };
}

export default async function AdvisingCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();
  const sessionUser = await getSessionUser();

  const sp = await searchParams;
  const focusLane = parseAdvisingLane(sp.lane);
  const requestedChapterId = typeof sp.chapterId === "string" ? sp.chapterId : null;

  const now = new Date();
  const data = await loadAdvisingCockpitData(
    { id: viewer.id, roles: viewer.roles, chapterId: sessionUser?.chapterId ?? null },
    now,
    { chapterId: requestedChapterId },
  );
  const cockpit = resolveActionHrefs(data.cockpit, isActionTrackerEnabled());

  // Only surface a "scoped to X" banner when an org-wide viewer actually
  // narrowed via ?chapterId= (a Chapter President is auto-scoped and their view
  // is unchanged, so no banner). data.scopeChapterId reflects the resolved,
  // escalation-safe scope, not the raw request.
  const scopedChapter =
    requestedChapterId && data.scopeChapterId === requestedChapterId
      ? { id: data.scopeChapterId, name: data.scopeChapterName }
      : null;

  const headline =
    cockpit.totalSituations === 0
      ? "Advising is fully covered — nothing needs attention right now."
      : `${cockpit.totalSituations} student/advisor situation${cockpit.totalSituations === 1 ? "" : "s"} need leadership attention.`;

  return (
    <div className="mx-auto w-full max-w-[1220px] px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-brand-600">
            Student advising
          </p>
          <h1 className="mt-1 font-sans text-[26px] font-extrabold leading-tight text-ink">
            Advising command center
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-muted">{headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/my-advisees" variant="secondary" size="sm">
            My advisees
          </ButtonLink>
          <ButtonLink href="/admin/leadership" variant="ghost" size="sm">
            Leadership roles
          </ButtonLink>
        </div>
      </header>

      {scopedChapter ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-brand-200 bg-brand-50 px-3 py-2">
          <span className="text-[13px] text-ink">
            Scoped to{" "}
            <b className="font-semibold text-brand-700">
              {scopedChapter.name ?? "one chapter"}
            </b>{" "}
            — showing only this chapter&apos;s advising.
          </span>
          <ButtonLink
            href={focusLane ? `/operations/advising?lane=${focusLane}` : "/operations/advising"}
            variant="ghost"
            size="sm"
          >
            Show all chapters
          </ButtonLink>
        </div>
      ) : null}

      <AdvisingCockpitClient
        cockpit={cockpit}
        advisorPool={data.advisorPool}
        focusLane={focusLane}
      />
    </div>
  );
}
