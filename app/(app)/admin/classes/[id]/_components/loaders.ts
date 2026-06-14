import { notFound } from "next/navigation";

import { getAdminClassDetail } from "@/lib/admin-class-operations";

export type ClassAdminDetail = NonNullable<Awaited<ReturnType<typeof getAdminClassDetail>>>;

export async function loadClassAdminDetail(id: string): Promise<ClassAdminDetail> {
  const detail = await getAdminClassDetail(id);
  if (!detail) notFound();
  return detail;
}

export function classApprovalStatus(detail: ClassAdminDetail): string {
  return detail.approval?.status ?? "NOT_REQUESTED";
}

export function classIsInReview(detail: ClassAdminDetail): boolean {
  const status = classApprovalStatus(detail);
  return (
    status === "REQUESTED" ||
    status === "UNDER_REVIEW" ||
    status === "CHANGES_REQUESTED"
  );
}

export function classShowFeedbackTab(detail: ClassAdminDetail): boolean {
  return (
    detail.status === "COMPLETED" ||
    detail.status === "CANCELLED" ||
    detail.confirmedCount > 0
  );
}
