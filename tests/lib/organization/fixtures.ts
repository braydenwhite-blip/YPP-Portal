// Shared fixtures for the organization-graph tests. Not a test file itself
// (vitest only picks up *.test.ts), so it can be imported freely.

import type {
  ChapterInput,
  ClassInput,
  CurriculumInput,
  EnrollmentInput,
  FamilyInput,
  GraphBlocker,
  OrgEvent,
  OrganizationGraphInput,
  PartnerInput,
  PersonInput,
} from "@/lib/organization/types";

export const NOW = new Date("2026-06-29T12:00:00Z");

export function chapter(over: Partial<ChapterInput> = {}): ChapterInput {
  return {
    id: "ch1",
    name: "Test Chapter",
    location: "City, ST",
    lifecycleStatus: "ACTIVE",
    lifecycleLabel: "Active",
    health: null,
    ...over,
  };
}

export function partner(id: string, over: Partial<PartnerInput> = {}): PartnerInput {
  return { id, name: `Partner ${id}`, type: "School", stageLabel: "Confirmed", confirmed: true, openIssues: 0, ...over };
}

export function curriculum(id: string, over: Partial<CurriculumInput> = {}): CurriculumInput {
  return { id, title: `Curriculum ${id}`, subject: "Robotics", statusLabel: "Approved", approved: true, submitted: true, ...over };
}

export function person(id: string, over: Partial<PersonInput> = {}): PersonInput {
  return { id, name: `Person ${id}`, ...over };
}

export function family(id: string, studentIds: string[], over: Partial<FamilyInput> = {}): FamilyInput {
  return { id, label: `Family ${id}`, studentIds, ...over };
}

export function klass(id: string, over: Partial<ClassInput> = {}): ClassInput {
  return {
    id,
    title: `Class ${id}`,
    statusLabel: "Published",
    stageLabel: "Live",
    health: "healthy",
    partnerId: null,
    curriculumId: null,
    instructorId: null,
    enrolledCount: 0,
    capacity: null,
    attendancePercent: null,
    averageRating: null,
    feedbackCount: 0,
    interventionNeeded: false,
    curriculumApproved: true,
    curriculumSubmitted: true,
    hasInstructor: true,
    scheduleConfirmed: true,
    partnerConfirmed: true,
    publiclyVisible: true,
    isLive: true,
    isCompleted: false,
    ...over,
  };
}

export function enrollment(id: string, studentId: string, classId: string, status = "ENROLLED"): EnrollmentInput {
  return { id, studentId, classId, status };
}

export function event(id: string, nodeIds: string[], over: Partial<OrgEvent> = {}): OrgEvent {
  return {
    id,
    kind: "other",
    title: `Event ${id}`,
    occurredAt: new Date("2026-06-20T12:00:00Z"),
    nodeIds,
    ...over,
  };
}

export function buildInput(over: Partial<OrganizationGraphInput> = {}): OrganizationGraphInput {
  return {
    chapterId: "ch1",
    now: NOW,
    chapter: chapter(),
    partners: [],
    curricula: [],
    instructors: [],
    students: [],
    families: [],
    classes: [],
    enrollments: [],
    blockers: [],
    events: [],
    ...over,
  };
}

/**
 * A coherent, moderately rich chapter:
 *  - p1 confirmed (no issues), p2 not confirmed (1 open issue)
 *  - cur1 approved, cur2 neither submitted nor approved (truly stuck)
 *  - i1 teaches cl1 (live, healthy) + cl2 (setup, stuck on cur2)
 *  - i2 teaches cl4 (completed, healthy) — light load
 *  - cl3 has no instructor (unstaffed, stuck)
 *  - s1 completed cl4; s2 enrolled cl1; s3 dropped cl1
 *  - f1 supports s1
 */
export function richInput(): OrganizationGraphInput {
  return buildInput({
    partners: [partner("p1"), partner("p2", { stageLabel: "Contacted", confirmed: false, openIssues: 1 })],
    curricula: [curriculum("cur1"), curriculum("cur2", { statusLabel: "Not started", approved: false, submitted: false })],
    instructors: [person("i1", { name: "Ivy" }), person("i2", { name: "Ian" })],
    students: [person("s1", { name: "Sam" }), person("s2", { name: "Sky" }), person("s3", { name: "Sage" })],
    families: [family("f1", ["s1"])],
    classes: [
      klass("cl1", {
        partnerId: "p1",
        curriculumId: "cur1",
        instructorId: "i1",
        enrolledCount: 10,
        capacity: 12,
        attendancePercent: 90,
        averageRating: 4.8,
        feedbackCount: 5,
      }),
      klass("cl2", {
        title: "Setup Class",
        stageLabel: "Draft",
        statusLabel: "Draft",
        health: "unknown",
        partnerId: "p1",
        curriculumId: "cur2",
        instructorId: "i1",
        curriculumApproved: false,
        curriculumSubmitted: false,
        publiclyVisible: false,
        isLive: false,
        capacity: 10,
      }),
      klass("cl3", {
        title: "Unstaffed Class",
        stageLabel: "Draft",
        statusLabel: "Draft",
        health: "unknown",
        partnerId: "p2",
        curriculumId: "cur1",
        instructorId: null,
        hasInstructor: false,
        publiclyVisible: false,
        isLive: false,
        capacity: 10,
      }),
      klass("cl4", {
        title: "Finished Class",
        stageLabel: "Completed",
        statusLabel: "Completed",
        health: "healthy",
        partnerId: "p1",
        curriculumId: "cur1",
        instructorId: "i2",
        enrolledCount: 8,
        capacity: 8,
        attendancePercent: 85,
        averageRating: 4.5,
        feedbackCount: 8,
        isLive: false,
        isCompleted: true,
      }),
    ],
    enrollments: [
      enrollment("e1", "s1", "cl4", "COMPLETED"),
      enrollment("e2", "s2", "cl1", "ENROLLED"),
      enrollment("e3", "s3", "cl1", "DROPPED"),
    ],
    blockers: [
      { key: "partner-issue:p2", severity: "warning", title: "Lincoln HS: follow-up overdue", href: "/admin/partners/p2", entityType: "PARTNER", entityId: "p2" },
      { key: "class-setup:cl3", severity: "critical", title: "Unstaffed Class: assign an instructor", href: "/admin/classes/cl3", entityType: "CLASS_OFFERING", entityId: "cl3" },
      { key: "applicant-decision:a1", severity: "warning", title: "Jordan: decision overdue", href: "/chapter/recruiting", entityType: "INSTRUCTOR_APPLICATION", entityId: "a1" },
    ],
    events: [
      event("ev-class-cl1", ["class:cl1"], { kind: "attendance", title: "Attendance recorded for Class cl1", occurredAt: new Date("2026-06-25T12:00:00Z") }),
      event("ev-curriculum-cur1", ["curriculum:cur1"], { kind: "curriculum", title: "Curriculum cur1 fully approved", occurredAt: new Date("2026-06-18T12:00:00Z") }),
      event("ev-enroll", ["student:s2", "class:cl1"], { kind: "enrollment", title: "Sky enrolled in Class cl1", occurredAt: new Date("2026-06-10T12:00:00Z") }),
    ],
  });
}
