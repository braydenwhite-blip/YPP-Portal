"use client";

// Instructor pairing drawer — pair or replace an instructor on a class. Wired
// to the existing RegularInstructorAssignment server actions (FormData-based),
// so the pairing lifecycle stays consistent with the admin assignments board.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModalV2, ModalFooterV2, Button, StatusBadge, cn } from "@/components/ui-v2";
import {
  createRegularInstructorAssignment,
  deleteRegularInstructorAssignment,
} from "@/lib/regular-instructor-assignments";
import type { PairingCard } from "@/lib/instructor-pairing/types";
import type { InstructorPickOption } from "@/lib/instructor-pairing/queries";

export type PairingDrawerRequest = { card: PairingCard; mode: "pair" | "replace" };

const inputClass =
  "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

const ROLES = ["LEAD", "CO_INSTRUCTOR", "ASSISTANT", "BACKUP"] as const;

export function PairingDrawer({
  request,
  instructorPool,
  onClose,
}: {
  request: PairingDrawerRequest | null;
  instructorPool: InstructorPickOption[];
  onClose: () => void;
}) {
  return (
    <ModalV2 open={request !== null} onClose={onClose} labelledBy="pairing-drawer-title" accent="brand">
      {request ? (
        <PairingForm key={request.card.id} request={request} instructorPool={instructorPool} onClose={onClose} />
      ) : (
        <span />
      )}
    </ModalV2>
  );
}

function PairingForm({
  request,
  instructorPool,
  onClose,
}: {
  request: PairingDrawerRequest;
  instructorPool: InstructorPickOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { card, mode } = request;

  const [instructorId, setInstructorId] = useState(card.suggestions[0]?.instructorId ?? "");
  const [role, setRole] = useState<(typeof ROLES)[number]>("LEAD");

  function offer(chosenId: string) {
    if (!card.offeringId) return;
    if (!chosenId) {
      setError("Pick an instructor first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "replace" && card.primaryAssignmentId) {
          const remove = new FormData();
          remove.set("assignmentId", card.primaryAssignmentId);
          await deleteRegularInstructorAssignment(remove);
        }
        const fd = new FormData();
        fd.set("offeringId", card.offeringId!);
        fd.set("instructorId", chosenId);
        fd.set("role", role);
        fd.set("status", "OFFERED");
        await createRegularInstructorAssignment(fd);
        router.refresh();
        onClose();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not send the offer. Try again.",
        );
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 id="pairing-drawer-title" className="font-sans text-[18px] font-bold text-ink">
          {mode === "replace" ? "Replace instructor" : "Pair instructor"}
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {card.title}
          {card.partnerName ? ` · ${card.partnerName}` : ""}
        </p>
      </div>

      <div className="rounded-[8px] bg-surface-soft px-3 py-2 text-[12.5px] text-ink">{card.why}</div>

      {card.suggestions.length > 0 && (
        <div className="grid gap-2">
          <p className="text-[12.5px] font-semibold text-ink">Suggested matches</p>
          {card.suggestions.map((s) => (
            <div
              key={s.instructorId}
              className={cn(
                "rounded-[10px] border p-3",
                instructorId === s.instructorId ? "border-brand-400 bg-brand-50" : "border-line-soft bg-surface",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setInstructorId(s.instructorId)}
                  className="text-left text-[13.5px] font-bold text-ink"
                >
                  {s.instructorName}
                </button>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={s.trained ? "success" : "warning"}>
                    {s.trained ? "Trained" : "Needs training"}
                  </StatusBadge>
                  <Button size="sm" variant="primary" disabled={isPending} onClick={() => offer(s.instructorId)}>
                    Send offer
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-[12px] text-ink-muted">
                {[...s.reasons, ...s.warnings].join(" · ")}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink">Or choose any instructor</span>
          <select value={instructorId} onChange={(e) => setInstructorId(e.target.value)} className={inputClass}>
            <option value="">Select instructor…</option>
            {instructorPool.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.activeLoad} class{i.activeLoad === 1 ? "" : "es"}
                {i.trained ? "" : " · needs training"}
                {i.chapterName ? ` · ${i.chapterName}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-[12.5px] text-danger-700">{error}</p> : null}

      <ModalFooterV2>
        <Button variant="ghost" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant="primary" disabled={isPending} onClick={() => offer(instructorId)}>
          {isPending ? "Sending…" : "Send offer"}
        </Button>
      </ModalFooterV2>
    </div>
  );
}
