import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  approveOfferingApproval,
  requestOfferingApprovalRevision,
  rejectOfferingApproval,
} from "@/lib/offering-approval-actions";
import { Button, RecordSection, StatusBadge } from "@/components/ui-v2";
import { inputClass } from "../_components/publish-controls";
import { classApprovalStatus, loadClassAdminDetail } from "../_components/loaders";

export const dynamic = "force-dynamic";

export default async function AdminClassReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.roles.includes("ADMIN")) {
    redirect("/");
  }

  const { id } = await params;
  const detail = await loadClassAdminDetail(id);

  const status = classApprovalStatus(detail);
  const isOpenForReview =
    status === "REQUESTED" ||
    status === "UNDER_REVIEW" ||
    status === "CHANGES_REQUESTED" ||
    status === "REJECTED";

  return (
    <div className="flex flex-col gap-5">
      <RecordSection
        title="Review decision"
        description={`Submitted by ${detail.instructor.name}`}
      >
        {!isOpenForReview && status === "APPROVED" ? (
          <p className="m-0 text-[13px] text-success-700">
            Approved. Publish from the Overview tab when ready.
          </p>
        ) : null}
        {!isOpenForReview && status === "NOT_REQUESTED" ? (
          <p className="m-0 text-[13px] text-ink-muted">
            The instructor has not requested review yet.
          </p>
        ) : null}

        {isOpenForReview ? (
          <div className="flex flex-col gap-4">
            <StatusBadge tone="warning">{status.replace(/_/g, " ")}</StatusBadge>

            <form action={approveOfferingApproval} className="flex flex-col gap-2">
              <input type="hidden" name="offeringId" value={detail.id} />
              <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-muted">
                Approval note (optional)
                <input name="reviewNotes" className={inputClass} />
              </label>
              <Button type="submit" variant="primary" size="md" className="self-start">
                Approve proposal
              </Button>
            </form>

            <form action={requestOfferingApprovalRevision} className="flex flex-col gap-2 border-t border-line-soft pt-4">
              <input type="hidden" name="offeringId" value={detail.id} />
              <input type="hidden" name="status" value="CHANGES_REQUESTED" />
              <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-muted">
                What needs to change?
                <textarea
                  name="reviewNotes"
                  rows={3}
                  required
                  className={`${inputClass} min-h-[80px] py-2`}
                  placeholder="Be specific — the instructor sees this verbatim."
                />
              </label>
              <Button type="submit" variant="secondary" size="sm" className="self-start">
                Request revisions
              </Button>
            </form>

            <form action={rejectOfferingApproval} className="flex flex-col gap-2 border-t border-line-soft pt-4">
              <input type="hidden" name="offeringId" value={detail.id} />
              <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-muted">
                Rejection reason
                <textarea
                  name="reviewNotes"
                  rows={3}
                  required
                  className={`${inputClass} min-h-[80px] py-2`}
                  placeholder="Required for the audit trail."
                />
              </label>
              <Button type="submit" variant="danger" size="sm" className="self-start">
                Reject proposal
              </Button>
            </form>
          </div>
        ) : null}
      </RecordSection>

      <RecordSection title="Proposal summary">
        {detail.template?.description ? (
          <p className="m-0 whitespace-pre-line text-[14px] leading-relaxed text-ink">
            {detail.template.description}
          </p>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">No description provided.</p>
        )}
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <MiniFact label="Format" value={detail.deliveryMode.replace("_", " ")} />
          <MiniFact label="Capacity" value={String(detail.capacity)} />
          <MiniFact label="Chapter" value={detail.chapter?.name ?? "—"} />
          <MiniFact label="Target ages" value={detail.template?.targetAgeGroup ?? "—"} />
          <MiniFact label="Starts" value={detail.startDate.toLocaleDateString()} />
          <MiniFact label="Schedule" value={detail.meetingDays.join(", ") || "—"} />
        </dl>
      </RecordSection>

      {detail.approval?.requestNotes ? (
        <RecordSection title="Instructor notes">
          <p className="m-0 whitespace-pre-line text-[13px] text-ink">
            {detail.approval.requestNotes}
          </p>
        </RecordSection>
      ) : null}

      {detail.approval?.reviewNotes ? (
        <RecordSection title="Previous review notes">
          <p className="m-0 whitespace-pre-line text-[13px] text-ink">
            {detail.approval.reviewNotes}
          </p>
        </RecordSection>
      ) : null}
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </dt>
      <dd className="m-0 mt-0.5 text-[14px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
