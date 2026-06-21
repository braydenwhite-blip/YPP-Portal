import Link from "next/link";

import {
  ActionButtonGroup,
  ButtonLink,
  KeyFactsGrid,
  PageHeaderV2,
  StatusBadge,
  type KeyFact,
  type StatusTone,
} from "@/components/ui-v2";
import type { ClassAdminDetail } from "./loaders";
import { classApprovalStatus, classIsInReview } from "./loaders";

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function statusTone(detail: ClassAdminDetail): StatusTone {
  if (detail.status === "CANCELLED") return "danger";
  if (detail.status === "COMPLETED") return "neutral";
  if (detail.status === "IN_PROGRESS") return "info";
  if (detail.isPublic && detail.enrollmentOpen) return "success";
  if (classIsInReview(detail)) return "warning";
  return "neutral";
}

function statusLabel(detail: ClassAdminDetail): string {
  if (detail.status === "PUBLISHED" && detail.enrollmentOpen) return "Live";
  if (detail.status === "PUBLISHED") return "Published · closed";
  if (detail.status === "IN_PROGRESS") return "In session";
  if (detail.status === "COMPLETED") return "Completed";
  if (detail.status === "CANCELLED") return "Cancelled";
  if (classIsInReview(detail)) return "In review";
  if (detail.isApproved && detail.status === "DRAFT") return "Ready to publish";
  return detail.status.replace("_", " ");
}

export function ClassAdminHeader({ detail }: { detail: ClassAdminDetail }) {
  const approval = classApprovalStatus(detail).replace(/_/g, " ");
  const fillPct =
    detail.capacity > 0
      ? Math.round((detail.confirmedCount / detail.capacity) * 100)
      : null;

  const facts: KeyFact[] = [
    {
      label: "Enrollment",
      value: detail.enrollmentOpen ? "Open" : "Closed",
      tone: detail.enrollmentOpen ? "default" : "attention",
    },
    {
      label: "Seats",
      value: `${detail.confirmedCount}/${detail.capacity}`,
      detail:
        detail.waitlistedCount > 0
          ? `+${detail.waitlistedCount} waitlist`
          : fillPct !== null && fillPct >= 100
            ? "At capacity"
            : undefined,
      tone: fillPct !== null && fillPct >= 100 ? "attention" : "default",
      href: `/admin/classes/${detail.id}/roster`,
    },
    {
      label: "Starts",
      value: detail.startDate.toLocaleDateString(undefined, DATE_FMT),
    },
    {
      label: "Instructor",
      value: detail.instructor.name ?? detail.instructor.email,
      detail: detail.chapter?.name ?? undefined,
    },
    {
      label: "Format",
      value: detail.deliveryMode.replace("_", " "),
    },
    {
      label: "Approval",
      value: approval,
      tone: detail.isApproved ? "default" : "attention",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeaderV2
        eyebrow="Classes"
        backHref="/admin/classes"
        backLabel="All classes"
        title={detail.title}
        subtitle={
          detail.template?.title
            ? `From ${detail.template.title}`
            : undefined
        }
        actions={
          <ActionButtonGroup aria-label="Class shortcuts">
            <ButtonLink href={`/admin/classes/${detail.id}/roster`} variant="primary" size="sm">
              Roster
            </ButtonLink>
            {classIsInReview(detail) ? (
              <ButtonLink href={`/admin/classes/${detail.id}/review`} variant="secondary" size="sm">
                Review
              </ButtonLink>
            ) : null}
            {detail.isPublic ? (
              <ButtonLink
                href={`/curriculum/${detail.id}`}
                variant="ghost"
                size="sm"
              >
                Student page ↗
              </ButtonLink>
            ) : null}
          </ActionButtonGroup>
        }
      >
        <StatusBadge tone={statusTone(detail)} withDot>
          {statusLabel(detail)}
        </StatusBadge>
      </PageHeaderV2>

      <KeyFactsGrid facts={facts} className="grid-cols-2 sm:grid-cols-3" />
    </div>
  );
}

export function ClassReviewBanner({ detail }: { detail: ClassAdminDetail }) {
  if (!classIsInReview(detail)) return null;

  return (
    <div className="rounded-[12px] border border-warning-700/25 bg-warning-100/40 px-4 py-3.5 sm:px-5">
      <p className="m-0 text-[14px] font-semibold text-ink">
        This class needs a review decision
      </p>
      <p className="m-0 mt-1 text-[13px] text-ink-muted">
        Approve, request changes, or reject from the review panel.
      </p>
      <Link
        href={`/admin/classes/${detail.id}/review`}
        className="mt-3 inline-flex text-[13px] font-semibold text-brand-700 no-underline hover:underline"
      >
        Open review →
      </Link>
    </div>
  );
}
