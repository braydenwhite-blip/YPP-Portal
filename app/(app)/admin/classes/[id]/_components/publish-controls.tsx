import {
  adminCancelClassOffering,
  adminCloseEnrollment,
  adminMarkClassCompleted,
  adminPublishClassOffering,
  adminReopenEnrollment,
  adminUnpublishClassOffering,
} from "@/lib/admin-class-operations";
import { computePublishReadiness } from "@/lib/class-publish-readiness";
import { PublishReadinessChecklist } from "@/components/classes/publish-readiness-checklist";
import { Button, RecordSection } from "@/components/ui-v2";
import type { ClassAdminDetail } from "./loaders";

const inputClass =
  "h-9.5 w-full rounded-[8px] border border-line bg-surface px-3 text-[13.5px] text-ink transition-colors hover:border-brand-400 focus:border-brand-500 focus:outline-2 focus:outline-offset-1 focus:outline-brand-400/40";

export function ClassPublishControls({
  detail,
}: {
  detail: ClassAdminDetail;
}) {
  const readiness = computePublishReadiness({
    title: detail.title,
    description: detail.template?.description,
    instructorId: detail.instructorId,
    startDate: detail.startDate,
    endDate: detail.endDate,
    meetingDays: detail.meetingDays,
    meetingTime: detail.meetingTime,
    capacity: detail.capacity,
    targetAgeGroup: detail.template?.targetAgeGroup,
    deliveryMode: detail.deliveryMode,
    locationName: detail.locationName,
    locationAddress: detail.locationAddress,
    zoomLink: detail.zoomLink,
    sessionCount: detail._count.sessions,
    approvalStatus: detail.approval?.status ?? null,
    grandfatheredTrainingExemption: detail.grandfatheredTrainingExemption,
    editHref: `/instructor/class-settings?offering=${detail.id}`,
    reviewHref: `/admin/classes/${detail.id}/review`,
  });

  const canPublish =
    detail.isApproved && detail.status === "DRAFT" && readiness.ready;
  const isLive =
    detail.status === "PUBLISHED" || detail.status === "IN_PROGRESS";
  const isTerminal =
    detail.status === "CANCELLED" || detail.status === "COMPLETED";

  return (
    <RecordSection
      title="Actions"
      description="Publish, close enrollment, or wrap up this class."
    >
      {detail.status === "DRAFT" ? (
        <div className="flex flex-col gap-4">
          {!detail.isApproved ? (
            <p className="m-0 text-[13px] text-danger-700">
              Approve this class in Review before publishing.
            </p>
          ) : null}
          {detail.isApproved && !readiness.ready ? (
            <p className="m-0 text-[13px] text-danger-700">
              Complete {readiness.missing.length} item
              {readiness.missing.length === 1 ? "" : "s"} below before publishing.
            </p>
          ) : null}
          <PublishReadinessChecklist readiness={readiness} />
          {canPublish ? (
            <form action={adminPublishClassOffering} className="flex flex-col gap-2">
              <input type="hidden" name="offeringId" value={detail.id} />
              <Button type="submit" variant="primary" size="md">
                Publish & open enrollment
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {isLive ? (
        <div className="flex flex-col gap-2">
          {detail.enrollmentOpen ? (
            <form action={adminCloseEnrollment}>
              <input type="hidden" name="offeringId" value={detail.id} />
              <Button type="submit" variant="secondary" size="md">
                Close enrollment
              </Button>
            </form>
          ) : (
            <form action={adminReopenEnrollment}>
              <input type="hidden" name="offeringId" value={detail.id} />
              <Button type="submit" variant="secondary" size="md">
                Reopen enrollment
              </Button>
            </form>
          )}
          <form action={adminUnpublishClassOffering}>
            <input type="hidden" name="offeringId" value={detail.id} />
            <Button type="submit" variant="ghost" size="sm">
              Unpublish (return to draft)
            </Button>
          </form>
        </div>
      ) : null}

      {!isTerminal && detail.status !== "DRAFT" ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-line-soft pt-4">
          <form action={adminMarkClassCompleted}>
            <input type="hidden" name="offeringId" value={detail.id} />
            <Button type="submit" variant="secondary" size="sm">
              Mark completed
            </Button>
          </form>
          <form action={adminCancelClassOffering}>
            <input type="hidden" name="offeringId" value={detail.id} />
            <Button type="submit" variant="danger" size="sm">
              Cancel class
            </Button>
          </form>
        </div>
      ) : null}

      {isTerminal ? (
        <p className="m-0 text-[13px] text-ink-muted">
          This class is {detail.status.toLowerCase().replace("_", " ")}. No further
          lifecycle actions are available.
        </p>
      ) : null}
    </RecordSection>
  );
}

export { inputClass };
