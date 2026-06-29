// The dependency engine. Every node can answer: what do I need to function,
// what is blocking me, and (via the graph) what becomes possible once I'm
// resolved. Dependencies are derived from each entity's own readiness signals
// plus a roll-up of the classes it touches. Pure + deterministic.

import { nodeId } from "@/lib/organization/types";
import type {
  ClassInput,
  CurriculumInput,
  NodeDependency,
  PartnerInput,
} from "@/lib/organization/types";

/** A class's structural dependencies, straight from its readiness signals. */
export function classDependencies(c: ClassInput): NodeDependency[] {
  const href = `/admin/classes/${c.id}`;
  const deps: NodeDependency[] = [];

  deps.push({
    key: "curriculum",
    label: "Approved curriculum",
    state: c.curriculumApproved ? "satisfied" : c.curriculumSubmitted ? "in_progress" : "blocked",
    blocking: !c.curriculumApproved && !c.isLive && !c.isCompleted,
    severity: "warning",
    detail: c.curriculumApproved
      ? undefined
      : c.curriculumSubmitted
        ? "Curriculum is awaiting full approval"
        : "Curriculum not submitted",
    nodeId: c.curriculumId ? nodeId("curriculum", c.curriculumId) : undefined,
    href,
  });

  deps.push({
    key: "instructor",
    label: "Instructor assigned",
    state: c.hasInstructor ? "satisfied" : "blocked",
    blocking: !c.hasInstructor && !c.isCompleted,
    severity: "warning",
    detail: c.hasInstructor ? undefined : "No instructor assigned yet",
    nodeId: c.instructorId ? nodeId("instructor", c.instructorId) : undefined,
    href,
  });

  deps.push({
    key: "schedule",
    label: "Schedule confirmed",
    state: c.scheduleConfirmed ? "satisfied" : "blocked",
    blocking: !c.scheduleConfirmed && !c.isCompleted,
    severity: "warning",
    detail: c.scheduleConfirmed ? undefined : "Meeting days/time not set",
    href,
  });

  deps.push({
    key: "partner",
    label: "Partner confirmed",
    state: c.partnerConfirmed ? "satisfied" : "in_progress",
    blocking: false,
    severity: "info",
    detail: c.partnerConfirmed ? undefined : "No partner site linked (may be virtual)",
    nodeId: c.partnerId ? nodeId("partner", c.partnerId) : undefined,
    href,
  });

  if (!c.isCompleted) {
    deps.push({
      key: "publish",
      label: "Published for enrollment",
      state: c.publiclyVisible ? "satisfied" : "in_progress",
      blocking: false,
      severity: "info",
      detail: c.publiclyVisible ? undefined : "Not yet visible to families",
      href,
    });
  }

  return deps;
}

export function partnerDependencies(p: PartnerInput): NodeDependency[] {
  const href = `/admin/partners/${p.id}`;
  const deps: NodeDependency[] = [];
  if (!p.confirmed) {
    deps.push({
      key: "confirmation",
      label: "Partnership confirmation",
      state: "in_progress",
      blocking: false,
      severity: "info",
      detail: `Currently ${p.stageLabel.toLowerCase()}`,
      href,
    });
  }
  if (p.openIssues > 0) {
    deps.push({
      key: "open-issues",
      label: `Resolve ${p.openIssues} open issue${p.openIssues === 1 ? "" : "s"}`,
      state: "blocked",
      blocking: true,
      severity: "warning",
      href,
    });
  }
  return deps;
}

export function curriculumDependencies(c: CurriculumInput): NodeDependency[] {
  if (c.approved) return [];
  return [
    {
      key: "approval",
      label: "Full approval",
      state: c.submitted ? "in_progress" : "blocked",
      blocking: true,
      severity: "warning",
      detail: c.submitted ? "Submitted, awaiting approval — gates every class using it" : "Not yet submitted for review",
      href: "/admin/curricula",
    },
  ];
}

/** An instructor's dependencies roll up from the classes they teach. */
export function instructorDependencies(classes: ClassInput[]): NodeDependency[] {
  const deps: NodeDependency[] = [];
  const intervention = classes.filter((c) => c.interventionNeeded);
  if (intervention.length > 0) {
    deps.push({
      key: "intervention",
      label: `${intervention.length} class${intervention.length === 1 ? "" : "es"} need support`,
      state: "blocked",
      blocking: true,
      severity: "warning",
      detail: intervention.map((c) => c.title).join(", "),
      href: "/chapter/operating",
    });
  }
  return deps;
}

/** A student's dependencies roll up from their enrollments. */
export function studentDependencies(input: { statuses: string[]; classes: ClassInput[] }): NodeDependency[] {
  const deps: NodeDependency[] = [];
  if (input.statuses.includes("WAITLISTED")) {
    deps.push({
      key: "waitlist",
      label: "Enrollment confirmation",
      state: "in_progress",
      blocking: false,
      severity: "info",
      detail: "On a waitlist for at least one class",
      href: "/chapter/students",
    });
  }
  const lowAttendance = input.classes.filter((c) => c.isLive && c.attendancePercent != null && c.attendancePercent < 60);
  if (lowAttendance.length > 0) {
    deps.push({
      key: "attendance",
      label: "Re-engage — attendance is low",
      state: "blocked",
      blocking: true,
      severity: "warning",
      detail: lowAttendance.map((c) => c.title).join(", "),
      href: "/chapter/students",
    });
  }
  return deps;
}

/** The blocking, currently-blocked subset — the "blocked because…" list. */
export function blockedByOf(deps: NodeDependency[]): NodeDependency[] {
  return deps.filter((d) => d.blocking && d.state === "blocked");
}
