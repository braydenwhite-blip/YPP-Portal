"use client";

// Student Advising cockpit — the guided operating room. Renders the briefing
// strip, decision lanes of spotlight cards, a secondary Browse-all, and wires
// every card action to a drawer, an Entity 360, or a context-preserving link.

import { useMemo, useState } from "react";
import {
  Button,
  ButtonLink,
  CardV2,
  SearchInputV2,
  StatusBadge,
  cn,
} from "@/components/ui-v2";
import {
  BriefingStrip,
  CockpitLane,
  LaneCards,
  Open360Button,
  SpotlightCard,
  type BriefingChipData,
} from "@/components/cockpit/primitives";
import type {
  AdvisingCard,
  AdvisingCardAction,
  AdvisingCockpit,
} from "@/lib/advising/types";
import type { AdvisorPickOption } from "@/lib/advising/queries";
import {
  AdvisingDrawer,
  type AdvisingDrawerKind,
  type AdvisingDrawerRequest,
} from "./advising-drawers";

const ACTION_TO_DRAWER: Partial<Record<AdvisingCardAction["kind"], AdvisingDrawerKind>> = {
  assign_advisor: "assign",
  review_suggestion: "assign",
  reassign_advisor: "reassign",
  schedule_kickoff: "kickoff",
  add_checkin: "checkin",
  create_followup: "followup",
  review_recommendation: "recommendation",
};

export function AdvisingCockpitClient({
  cockpit,
  advisorPool,
}: {
  cockpit: AdvisingCockpit;
  advisorPool: AdvisorPickOption[];
}) {
  const [request, setRequest] = useState<AdvisingDrawerRequest | null>(null);

  const briefingChips: BriefingChipData[] = cockpit.briefing.map((c) => ({
    key: c.key,
    label: c.label,
    count: c.count,
    tone: c.tone,
    laneId: c.lane,
  }));

  function renderAction(card: AdvisingCard, action: AdvisingCardAction, primary: boolean) {
    const variant = primary ? "primary" : "ghost";
    const key = `${card.id}:${action.kind}`;

    if (action.kind === "open_student_360" && card.studentId) {
      return <Open360Button key={key} type="person" id={card.studentId} label={action.label} variant={variant} />;
    }
    if ((action.kind === "open_advisor_360" || action.kind === "redistribute_caseload") && card.advisorId) {
      return <Open360Button key={key} type="person" id={card.advisorId} label={action.label} variant={variant} />;
    }
    if (action.kind === "create_advising_action") {
      if (!action.href) return null;
      return (
        <ButtonLink key={key} href={action.href} variant={variant} size="sm">
          {action.label}
        </ButtonLink>
      );
    }
    const drawerKind = ACTION_TO_DRAWER[action.kind];
    if (drawerKind) {
      return (
        <Button key={key} variant={variant} size="sm" onClick={() => setRequest({ kind: drawerKind, card })}>
          {action.label}
        </Button>
      );
    }
    return null;
  }

  function renderCard(card: AdvisingCard) {
    return (
      <SpotlightCard
        key={card.id}
        accentTone={card.accentTone}
        statusLabel={card.statusLabel}
        statusTone={card.statusTone}
        title={card.title}
        subtitle={card.subtitle}
        why={card.why}
        context={card.context}
        metaLine={card.metaLine}
        nextAction={card.nextAction}
        actions={
          <>
            {renderAction(card, card.primaryAction, true)}
            {card.secondaryActions.map((a) => renderAction(card, a, false))}
          </>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      <BriefingStrip chips={briefingChips} />

      <div className="grid gap-8">
        {cockpit.lanes.map((lane) => (
          <CockpitLane key={lane.lane} laneId={lane.lane} label={lane.label} blurb={lane.blurb} count={lane.total}>
            <LaneCards
              cards={lane.cards.map(renderCard)}
              emptyTitle={lane.emptyTitle}
              emptyBody={lane.emptyBody}
            />
          </CockpitLane>
        ))}
      </div>

      <BrowseAll cockpit={cockpit} onAct={(card) => {
        const drawerKind = ACTION_TO_DRAWER[card.primaryAction.kind];
        if (drawerKind) setRequest({ kind: drawerKind, card });
      }} />

      <AdvisingDrawer request={request} advisorPool={advisorPool} onClose={() => setRequest(null)} />
    </div>
  );
}

function BrowseAll({
  cockpit,
  onAct,
}: {
  cockpit: AdvisingCockpit;
  onAct: (card: AdvisingCard) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allCards = useMemo(
    () => cockpit.lanes.flatMap((l) => l.cards),
    [cockpit],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCards;
    return allCards.filter((c) =>
      [c.title, c.subtitle, c.advisorName, c.statusLabel]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [allCards, query]);

  return (
    <CardV2 padding="md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-sans text-[14px] font-bold text-ink">
          Browse all situations
          <span className="ml-2 rounded-full bg-surface-soft px-2 py-0.5 text-[11.5px] font-semibold text-ink-muted">
            {allCards.length}
          </span>
        </span>
        <span className="text-[12px] text-ink-muted">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-3">
          <SearchInputV2
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by student, advisor, status…"
          />
          {filtered.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No situations match “{query}”.</p>
          ) : (
            <div className="overflow-hidden rounded-[10px] border border-line-soft">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface-soft text-left text-[11.5px] uppercase tracking-[0.04em] text-ink-muted">
                    <th className="px-3 py-2 font-bold">Subject</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2 font-bold">Advisor</th>
                    <th className="px-3 py-2 font-bold">Next step</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t border-line-soft">
                      <td className="px-3 py-2 font-semibold text-ink">{c.title}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={c.statusTone}>{c.statusLabel}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{c.advisorName ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-muted">{c.nextAction}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => onAct(c)}>
                          {c.primaryAction.label}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </CardV2>
  );
}
