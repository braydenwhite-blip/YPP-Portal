import { StudentIntakeCaseStatus } from "@prisma/client";

export const STUDENT_INTAKE_STATUS_META: Record<
  StudentIntakeCaseStatus,
  { label: string; color: string; background: string }
> = {
  DRAFT: {
    label: "Draft",
    color: "#475569",
    background: "#f8fafc",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "#1d4ed8",
    background: "#eff6ff",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "#7c3aed",
    background: "#f5f3ff",
  },
  APPROVED: {
    label: "Approved",
    color: "#166534",
    background: "#f0fdf4",
  },
  REJECTED: {
    label: "Needs Follow-Up",
    color: "#b91c1c",
    background: "#fef2f2",
  },
  MENTOR_PLAN_LAUNCHED: {
    label: "Mentor Plan Launched",
    color: "#0f766e",
    background: "#ecfeff",
  },
};

export function getStudentIntakeStatusMeta(status: StudentIntakeCaseStatus) {
  return STUDENT_INTAKE_STATUS_META[status];
}
