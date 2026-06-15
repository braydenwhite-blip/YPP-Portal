"use client";

// Instructor Pairing cockpit — the guided operating room. Briefing strip,
// coverage lanes of spotlight cards, secondary Browse-all, and every card
// action wired to a drawer, an inline confirmation, an Entity 360, or a
// context-preserving link.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ButtonLink,
  CardV2,
  SearchInputV2,
  StatusBadge,
} from "@/components/ui-v2";
import {
  BriefingStrip,
  CockpitLane,
  LaneCards,
  Open360Button,
  SpotlightCard,
  type BriefingChipData,
} from "@/components/cockpit/primitives";
import { updateRegularInstructorAssignmentStatus } from "@/lib/regular-instructor-assignments";
import type {
  PairingCard,
  PairingCardAction,
  PairingCockpit,
} from "@/lib/instructor-pairing/types";
import type { InstructorPickOption } from "@/lib/instructor-pairing/queries";
import { PairingDrawer, type PairingDrawerRequest } from "./pairing-drawers";

export function PairingCockpitClient({
  cockpit,
  instructorPool,
}: {
  cockpit: PairingCockpit;
  instructorPool: InstructorPickOption[];
}) {
  const router = useRouter();
  const [request, setRequest] = useState<PairingDrawerRequest | null>(null);
  const [isPending, startTransition] = useTransition();

  const briefingChips: BriefingChipData[] = cockpit.briefing.map((c) => ({
    key: c.key,
    label: c.label,
    count: c.count,
    tone: c.tone,
    laneId: c.lane,
  }));

  function confirmStatus(assignmentId: string, nextStatus: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("assignmentId", assignmentId);
      fd.set("status", nextStatus);
      await updateRegularInstructorAssignmentStatus(fd);
      router.refresh();
    });
  }

  function renderAction(card: PairingCard, action: PairingCardAction, primary: boolean) {
    const variant = primary ? "primary" : "ghost";
    const key = `${card.id}:${action.kind}:${action.label}`;

    switch (action.kind) {
      case "pair_instructor":
      case "review_suggestion":
        return (
          <Button key={key} variant={variant} size="sm" onClick={() => setRequest({ card, mode: "pair" })}>
            {action.label}
          </Button>
        );
      case "replace_instructor":
        return (
          <Button key={key} variant={variant} size="sm" onClick={() => setRequest({ card, mode: "replace" })}>
            {action.label}
          </Button>
        );
      case "confirm_instructor":
      case "request_partner_confirmation":
        if (!action.assignmentId || !action.nextStatus) return null;
        return (
          <Button
            key={key}
            variant={variant}
            size="sm"
            disabled={isPending}
            onClick={() => confirmStatus(action.assignmentId!, action.nextStatus!)}
          >
            {action.label}
          </Button>
        );
      case "schedule_training":
      case "create_coverage_action":
        if (!action.href) return null;
        return (
          <ButtonLink key={key} href={action.href} variant={variant} size="sm">
            {action.label}
          </ButtonLink>
        );
      case "assign_owner":
        if (!action.partnerId) return null;
        return (
          <ButtonLink key={key} href={`/admin/partners/${action.partnerId}`} variant={variant} size="sm">
            {action.label}
          </ButtonLink>
        );
      case "place_instructor":
        return (
          <ButtonLink key={key} href="/admin/instructor-assignments/new" variant={variant} size="sm">
            {action.label}
          </ButtonLink>
        );
      case "open_class_360":
        if (!action.offeringId) return null;
        return <Open360Button key={key} type="class" id={action.offeringId} label={action.label} variant={variant} />;
      case "open_partner_360":
        if (!action.partnerId) return null;
        return <Open360Button key={key} type="partner" id={action.partnerId} label={action.label} variant={variant} />;
      case "open_instructor_360":
        if (!action.instructorId) return null;
        return <Open360Button key={key} type="person" id={action.instructorId} label={action.label} variant={variant} />;
      default:
        return null;
    }
  }

  function renderCard(card: PairingCard) {
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
            <LaneCards cards={lane.cards.map(renderCard)} emptyTitle={lane.emptyTitle} emptyBody={lane.emptyBody} />
          </CockpitLane>
        ))}
      </div>

      <BrowseAll cockpit={cockpit} renderAction={renderAction} />

      <PairingDrawer request={request} instructorPool={instructorPool} onClose={() => setRequest(null)} />
    </div>
  );
}

function BrowseAll({
  cockpit,
  renderAction,
}: {
  cockpit: PairingCockpit;
  renderAction: (card: PairingCard, action: PairingCardAction, primary: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const allCards = useMemo(() => cockpit.lanes.flatMap((l) => l.cards), [cockpit]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCards;
    return allCards.filter((c) =>
      [c.title, c.subtitle, c.partnerName, c.instructorName, c.statusLabel]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [allCards, query]);

  return (
    <CardV2 padding="md">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="font-sans text-[14px] font-bold text-ink">
          Browse all coverage
          <span className="ml-2 rounded-full bg-surface-soft px-2 py-0.5 text-[11.5px] font-semibold text-ink-muted">
            {allCards.length}
          </span>
        </span>
        <span className="text-[12px] text-ink-muted">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-3">
          <SearchInputV2 value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by class, partner, instructor, status…" />
          {filtered.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No coverage matches “{query}”.</p>
          ) : (
            <div className="overflow-hidden rounded-[10px] border border-line-soft">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface-soft text-left text-[11.5px] uppercase tracking-[0.04em] text-ink-muted">
                    <th className="px-3 py-2 font-bold">Class</th>
                    <th className="px-3 py-2 font-bold">Partner</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2 font-bold">Instructor</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t border-line-soft">
                      <td className="px-3 py-2 font-semibold text-ink">{c.title}</td>
                      <td className="px-3 py-2 text-ink-muted">{c.partnerName ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={c.statusTone}>{c.statusLabel}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{c.instructorName ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{renderAction(c, c.primaryAction, false)}</td>
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
