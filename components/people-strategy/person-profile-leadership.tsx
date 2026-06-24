"use client";

import { useState } from "react";

import { FeedbackRequestDrawer } from "@/components/people-strategy/feedback-request-drawer";
import { FeedbackReviewDrawer } from "@/components/people-strategy/feedback-review-drawer";
import { PersonReviewPanel } from "@/components/people-strategy/person-review-panel";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

type Member = { id: string; name: string };

export function PersonProfileLeadership({
  row,
  monthLabel,
  monthShortLabel,
  quarter,
  quarterlyEnabled,
}: {
  row: PeoplePerformanceRow;
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
}) {
  const [reviewMember, setReviewMember] = useState<Member | null>(null);
  const [requestMember, setRequestMember] = useState<Member | null>(null);

  return (
    <>
      <PersonReviewPanel
        row={row}
        monthLabel={monthLabel}
        monthShortLabel={monthShortLabel}
        quarter={quarter}
        quarterlyEnabled={quarterlyEnabled}
        onReviewFeedback={setReviewMember}
        onRequestFeedback={setRequestMember}
      />
      <FeedbackReviewDrawer member={reviewMember} onClose={() => setReviewMember(null)} />
      <FeedbackRequestDrawer member={requestMember} onClose={() => setRequestMember(null)} />
    </>
  );
}
