type DecisionLike = {
  hiringChairStatus?: string | null;
};

export function getHiringChairStatus(decision: DecisionLike | null | undefined) {
  if (!decision) return null;
  return decision.hiringChairStatus ?? "APPROVED";
}

export function isHiringDecisionApproved(decision: DecisionLike | null | undefined) {
  return getHiringChairStatus(decision) === "APPROVED";
}

export function isHiringDecisionPending(decision: DecisionLike | null | undefined) {
  return getHiringChairStatus(decision) === "PENDING_CHAIR";
}

export function isHiringDecisionReturned(decision: DecisionLike | null | undefined) {
  return getHiringChairStatus(decision) === "RETURNED";
}

export function isHiringDecisionSubmitted(decision: DecisionLike | null | undefined) {
  return (
    getHiringChairStatus(decision) === "PENDING_CHAIR" ||
    getHiringChairStatus(decision) === "RETURNED" ||
    getHiringChairStatus(decision) === "APPROVED"
  );
}
