"use client";

import { useMemo, useState } from "react";

import { CardV2, StatusBadge } from "@/components/ui-v2";
import { assignCommitteeChair } from "@/lib/mentorship-program-actions";
import { reassignPrimaryMentorFromForm } from "@/lib/mentorship-reassign-actions";

import { AssignGoalsForm } from "./assign-goals-form";

const ADVISORY_MENTOR_CAPACITY = 3;

export type SetupCandidate = {
  id: string;
  name: string;
  email: string;
  role: string;
  activeMenteeCount: number;
};

export type MentorshipSetupData = {
  canManageMentor: boolean;
  canAssignGR: boolean;
  canAssignChair: boolean;
  activeMentorshipId: string | null;
  currentMentorId: string | null;
  candidates: SetupCandidate[];
  chairLane: string | null;
  currentChairName: string | null;
};

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function SetupRepairPanel({
  personId,
  personName,
  needsMentor,
  needsGR,
  needsChair,
  setup,
}: {
  personId: string;
  personName: string;
  needsMentor: boolean;
  needsGR: boolean;
  needsChair: boolean;
  setup: MentorshipSetupData;
}) {
  const [query, setQuery] = useState("");
  const [selectedMentorId, setSelectedMentorId] = useState(setup.currentMentorId ?? "");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCandidates = useMemo(
    () =>
      setup.candidates.filter((candidate) => {
        if (!normalizedQuery) return true;
        return `${candidate.name} ${candidate.email} ${candidate.role}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, setup.candidates]
  );
  const selectedCandidate = setup.candidates.find((candidate) => candidate.id === selectedMentorId);

  return (
    <CardV2 as="section" padding="md" className="border-l-4 border-l-progress-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">Finish mentorship setup</h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Fix the missing setup here, then the monthly cycle can continue automatically.
          </p>
        </div>
        <StatusBadge tone="warning">Setup required</StatusBadge>
      </div>

      {!needsMentor && !needsGR && !needsChair ? (
        <p className="m-0 mt-4 rounded-lg bg-success-100 px-3 py-2 text-[13px] font-medium text-success-700">
          Setup is complete. Continue with the next step shown above.
        </p>
      ) : null}

      {needsMentor ? (
        <div className="mt-4 border-t border-subtle pt-4">
          <h3 className="m-0 text-[13.5px] font-semibold text-ink">1. Assign a mentor</h3>
          {setup.canManageMentor ? (
            <form action={reassignPrimaryMentorFromForm} className="mt-3 grid gap-3">
              <input type="hidden" name="menteeId" value={personId} />
              <label className="grid gap-1.5 text-[12.5px] font-semibold text-ink">
                Search any active member
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type a name, email, or role"
                  className="h-10 rounded-lg border border-subtle bg-white px-3 text-[13px] font-normal outline-none focus:border-brand-600"
                />
              </label>
              <label className="grid gap-1.5 text-[12.5px] font-semibold text-ink">
                Mentor
                <select
                  name="newMentorId"
                  required
                  value={selectedMentorId}
                  onChange={(event) => setSelectedMentorId(event.target.value)}
                  className="h-10 rounded-lg border border-subtle bg-white px-3 text-[13px] font-normal outline-none focus:border-brand-600"
                >
                  <option value="">Select a mentor</option>
                  {visibleCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} · {roleLabel(candidate.role)} · {candidate.activeMenteeCount} active
                    </option>
                  ))}
                </select>
              </label>
              {selectedCandidate &&
              selectedCandidate.activeMenteeCount >= ADVISORY_MENTOR_CAPACITY ? (
                <p className="m-0 rounded-lg bg-progress-50 px-3 py-2 text-[12.5px] text-progress-900">
                  Capacity warning: {selectedCandidate.name} already has{" "}
                  {selectedCandidate.activeMenteeCount} active mentees. You may still assign them.
                </p>
              ) : null}
              <label className="grid gap-1.5 text-[12.5px] font-semibold text-ink">
                Reason or handoff note
                <textarea
                  name="reason"
                  rows={2}
                  placeholder="Why this assignment is the right fit"
                  className="rounded-lg border border-subtle bg-white px-3 py-2 text-[13px] font-normal outline-none focus:border-brand-600"
                />
              </label>
              <button
                type="submit"
                disabled={!selectedMentorId}
                className="justify-self-start rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selectedCandidate &&
                selectedCandidate.activeMenteeCount >= ADVISORY_MENTOR_CAPACITY
                  ? "Assign anyway"
                  : "Assign mentor"}
              </button>
            </form>
          ) : (
            <p className="m-0 mt-2 text-[13px] text-ink-muted">
              An authorized leadership member must assign {personName}&apos;s mentor.
            </p>
          )}
        </div>
      ) : null}

      {needsGR ? (
        <div className="mt-4 border-t border-subtle pt-4">
          <h3 className="m-0 text-[13.5px] font-semibold text-ink">
            {needsMentor ? "2" : "1"}. Assign Goals &amp; Responsibilities
          </h3>
          {!setup.activeMentorshipId ? (
            <p className="m-0 mt-2 text-[13px] text-ink-muted">
              Assign a mentor first. The G&amp;R document will attach to that relationship.
            </p>
          ) : setup.canAssignGR ? (
            <div className="mt-3">
              <AssignGoalsForm
                personId={personId}
                mentorshipId={setup.activeMentorshipId}
              />
            </div>
          ) : (
            <p className="m-0 mt-2 text-[13px] text-ink-muted">
              {personName}&apos;s mentor (or an admin) can assign goals on the Goals tab.
            </p>
          )}
        </div>
      ) : null}

      {needsChair ? (
        <div className="mt-4 border-t border-subtle pt-4">
          <h3 className="m-0 text-[13.5px] font-semibold text-ink">
            Assign the Role Chair
          </h3>
          {setup.currentChairName ? (
            <p className="m-0 mt-2 text-[13px] text-ink-muted">
              Current lane chair: {setup.currentChairName}
            </p>
          ) : null}
          {setup.canAssignChair && setup.chairLane ? (
            <form action={assignCommitteeChair} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="lane" value={setup.chairLane} />
              <label className="grid min-w-[260px] flex-1 gap-1.5 text-[12.5px] font-semibold text-ink">
                Chair
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="h-10 rounded-lg border border-subtle bg-white px-3 text-[13px] font-normal outline-none focus:border-brand-600"
                >
                  <option value="" disabled>
                    Select any active member
                  </option>
                  {setup.candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} · {roleLabel(candidate.role)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="h-10 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white"
              >
                Assign Role Chair
              </button>
            </form>
          ) : (
            <p className="m-0 mt-2 text-[13px] text-ink-muted">
              A mentorship admin must assign the Role Chair for this lane.
            </p>
          )}
        </div>
      ) : null}
    </CardV2>
  );
}
