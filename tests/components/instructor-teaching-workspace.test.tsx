import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstructorTeachingHome } from "@/components/instructor/instructor-teaching-home";
import { InstructorClassDetailView } from "@/components/classes/instructor-class-detail-view";
import type {
  InstructorTeachingWorkspace,
  TeachingClass,
} from "@/lib/classes/instructor-workspace";

function teachingClass(): TeachingClass {
  const session = {
    id: "session-1",
    sessionNumber: 3,
    topic: "Build and test a prototype",
    date: new Date("2030-07-12T00:00:00.000Z"),
    startTime: "16:00",
    endTime: "17:00",
    description: "Students build a prototype and explain one design decision.",
    learningOutcomes: ["Explain one design decision"],
    milestone: "First working prototype",
    isCancelled: false,
    cancelReason: null,
    materialsUrl: "https://example.com/worksheet",
    notesUrl: "https://example.com/slides",
    recordingUrl: null,
    lessonPlan: {
      id: "plan-1",
      title: "Prototype Lab",
      description: "A guided build session.",
      totalMinutes: 60,
      activities: [
        {
          id: "activity-1",
          title: "Build sprint",
          description: "Students build in pairs.",
          resources: "Prototype worksheet",
          notes: null,
          durationMin: 30,
        },
      ],
    },
    materials: [
      {
        key: "lesson",
        label: "Prototype Lab",
        kind: "lesson" as const,
        href: "/instructor/classes/class-1?session=session-1#before",
        detail: "A guided build session.",
      },
    ],
    state: {
      lifecycle: "before" as const,
      startsAt: new Date("2030-07-12T22:00:00.000Z"),
      endsAt: new Date("2030-07-12T23:00:00.000Z"),
      preparation: {
        complete: false,
        checks: [
          { key: "lesson" as const, label: "Lesson is ready to review", complete: true, reason: "Lesson attached." },
          { key: "materials" as const, label: "Teaching materials are attached", complete: true, reason: "Materials attached." },
          { key: "location" as const, label: "Class location is confirmed", complete: true, reason: "Location attached." },
          { key: "review" as const, label: "Preparation review is complete", complete: false, reason: "You have not marked this session's preparation review complete." },
        ],
        incompleteReasons: ["You have not marked this session's preparation review complete."],
      },
      attendance: "partial" as const,
      action: {
        kind: "finish_preparation" as const,
        label: "Finish preparation",
        title: "Finish preparing Session 3",
        reason: "You have not marked this session's preparation review complete.",
        href: "/instructor/classes/class-1?session=session-1#before",
        rank: 3,
      },
    },
    attendanceMarks: [
      { studentId: "student-1", status: "PRESENT", note: "Called family before class." },
    ],
    expectedStudentIds: ["student-1", "student-2"],
    reflection: null,
    preparation: null,
  };

  return {
    id: "class-1",
    title: "Design for Good",
    canManageSettings: true,
    status: "IN_PROGRESS",
    startDate: new Date("2030-07-01T00:00:00.000Z"),
    endDate: new Date("2030-08-01T00:00:00.000Z"),
    timezone: "America/Denver",
    deliveryMode: "VIRTUAL",
    scheduleLabel: "Friday · 16:00-17:00",
    locationLabel: "Online",
    locationAddress: null,
    arrivalInstructions: null,
    zoomLink: "https://example.com/meet",
    materialsList: ["Notebook"],
    ageRange: "12-14",
    roster: [
      {
        studentId: "student-1",
        name: "Avery Student",
        email: "avery@example.com",
        status: "ENROLLED",
        instructorNotes: "Offer a written copy of multi-step directions.",
        signupGoal: "Build something useful for the community.",
        signupNote: null,
        signals: [],
      },
      {
        studentId: "student-2",
        name: "Jordan Student",
        email: "jordan@example.com",
        status: "ENROLLED",
        instructorNotes: null,
        signupGoal: null,
        signupNote: null,
        signals: [],
      },
    ],
    sessions: [session],
    nextSession: session,
    primaryAction: session.state.action,
    stateReason: session.state.action.reason,
    leadershipRequests: [],
    studentAttention: [],
    lessonPlans: [
      {
        id: "plan-1",
        title: "Prototype Lab",
        description: "A guided build session.",
        totalMinutes: 60,
        updatedAt: new Date("2030-07-01T00:00:00.000Z"),
        activities: [
          {
            id: "activity-1",
            title: "Build sprint",
            resources: "Prototype worksheet",
            notes: null,
            durationMin: 30,
          },
        ],
      },
    ],
    approval: { status: "APPROVED", requestNotes: null, reviewNotes: null, requestedAt: null, reviewedAt: null },
    curriculumApproval: { stage: "FULLY_APPROVED", cpReviewNotes: null, globalReviewNotes: null },
    evidence: { sessionsHeld: 2, attendanceComplete: 2, recapsComplete: 2, feedbackCount: 1, recommendCount: 1 },
  } as unknown as TeachingClass;
}

function workspace(): InstructorTeachingWorkspace {
  const active = teachingClass();
  return {
    classes: [active],
    activeClasses: [active],
    completedClasses: [],
    nextClass: { teachingClass: active, session: active.sessions[0] },
    priorityAction: {
      ...active.sessions[0].state.action,
      classId: active.id,
      className: active.title,
      source: "session",
    },
    studentsNeedingAttention: [],
    leadershipRequests: [],
    readiness: { available: true, complete: true, missingRequirements: [] },
    evidence: active.evidence,
  };
}

describe("InstructorTeachingHome", () => {
  it("lists classes with an open link and shows updates", () => {
    render(
      <InstructorTeachingHome
        name="Taylor"
        workspace={workspace()}
        unreadNotifications={1}
        recentNotifications={[
          {
            id: "n1",
            title: "Class roster updated",
            body: "A student joined Design for Good.",
            link: "/instructor/classes/class-1",
            isRead: false,
            createdAt: new Date("2026-07-20T12:00:00Z").toISOString(),
          },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Your classes" })).toBeInTheDocument();
    expect(screen.getByText("Design for Good")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/instructor/classes/class-1"
    );
    expect(screen.getByRole("heading", { name: "Updates" })).toBeInTheDocument();
    expect(screen.getByText("Class roster updated")).toBeInTheDocument();
    expect(screen.getByText("1 new")).toBeInTheDocument();
  });

  it("renders an empty classes and updates state", () => {
    const empty = workspace();
    empty.classes = [];
    empty.activeClasses = [];
    empty.nextClass = null;
    empty.priorityAction = null;
    render(
      <InstructorTeachingHome
        name="Taylor"
        workspace={empty}
        unreadNotifications={0}
        recentNotifications={[]}
      />
    );

    expect(screen.getByText(/No classes assigned yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No updates yet/i)).toBeInTheDocument();
  });
});

describe("InstructorClassDetailView", () => {
  it("keeps Before, During, After, materials, roster context, and notes together", () => {
    render(<InstructorClassDetailView detail={teachingClass()} initialSessionId="session-1" />);

    expect(screen.getByRole("heading", { name: "Know the lesson and arrive ready" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Teach without leaving this page" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Close the loop while it is fresh" })).toBeInTheDocument();
    expect(screen.getAllByText("Offer a written copy of multi-step directions.")).not.toHaveLength(0);
    expect(screen.getByDisplayValue("Called family before class.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save attendance" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit recap" })).toBeDisabled();
  });
});
