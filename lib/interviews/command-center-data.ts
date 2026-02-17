import { prisma } from "@/lib/prisma";
import {
  buildHiringInterviewTask,
  buildReadinessInterviewTask,
  matchesInterviewState,
} from "@/lib/interviews/workflow";
import type {
  InterviewCommandCenterData,
  InterviewHubFilters,
  InterviewScope,
  InterviewStateFilter,
  InterviewTask,
  InterviewView,
} from "@/lib/interviews/types";
import type { Prisma } from "@prisma/client";

const FINAL_APPLICATION_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const;

const VALID_SCOPES: InterviewScope[] = ["all", "hiring", "readiness"];
const VALID_VIEWS: InterviewView[] = ["mine", "team"];
const VALID_STATES: Array<InterviewStateFilter | "all"> = [
  "all",
  "needs_action",
  "scheduled",
  "completed",
  "blocked",
];

type GetInterviewCommandCenterDataInput = {
  userId: string;
  roles: string[];
  scope?: string;
  view?: string;
  state?: string;
};

function normalizeScope(raw: string | undefined, canHiring: boolean, canReadiness: boolean): InterviewScope {
  const selected = VALID_SCOPES.includes(raw as InterviewScope) ? (raw as InterviewScope) : "all";

  if (!canReadiness) {
    return "hiring";
  }
  if (!canHiring) {
    return "readiness";
  }

  return selected;
}

function normalizeView(raw: string | undefined, canTeamView: boolean): InterviewView {
  const selected = VALID_VIEWS.includes(raw as InterviewView) ? (raw as InterviewView) : undefined;
  if (!canTeamView) return "mine";
  return selected ?? "team";
}

function normalizeState(raw: string | undefined): InterviewStateFilter | "all" {
  return VALID_STATES.includes(raw as InterviewStateFilter | "all")
    ? (raw as InterviewStateFilter | "all")
    : "all";
}

function stageRank(task: InterviewTask) {
  if (task.stage === "NEEDS_ACTION") return 0;
  if (task.stage === "BLOCKED") return 1;
  if (task.stage === "SCHEDULED") return 2;
  return 3;
}

function taskTimestamp(task: InterviewTask) {
  return (
    task.timestamps?.scheduledAt?.getTime() ??
    task.timestamps?.submittedAt?.getTime() ??
    task.timestamps?.completedAt?.getTime() ??
    0
  );
}

function sortTasks(tasks: InterviewTask[]) {
  return tasks.sort((a, b) => {
    const rankDiff = stageRank(a) - stageRank(b);
    if (rankDiff !== 0) return rankDiff;
    return taskTimestamp(b) - taskTimestamp(a);
  });
}

export async function getInterviewCommandCenterData(
  input: GetInterviewCommandCenterDataInput
): Promise<InterviewCommandCenterData> {
  const isAdmin = input.roles.includes("ADMIN");
  const isChapterLead = input.roles.includes("CHAPTER_LEAD");
  const isReviewer = isAdmin || isChapterLead;
  const isInstructor = input.roles.includes("INSTRUCTOR");
  const canTeamView = isReviewer;
  const canHiring = ["STUDENT", "INSTRUCTOR", "STAFF", "ADMIN", "CHAPTER_LEAD"].some((role) =>
    input.roles.includes(role)
  );
  const canReadiness = isInstructor || isReviewer;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      chapterId: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const filters: InterviewHubFilters = {
    scope: normalizeScope(input.scope, canHiring, canReadiness),
    view: normalizeView(input.view, canTeamView),
    state: normalizeState(input.state),
  };

  const tasks: InterviewTask[] = [];

  const includeHiring = filters.scope === "all" || filters.scope === "hiring";
  const includeReadiness = filters.scope === "all" || filters.scope === "readiness";

  if (includeHiring && canHiring) {
    if (filters.view === "mine") {
      const applications = await prisma.application.findMany({
        where: {
          applicantId: input.userId,
          status: { notIn: [...FINAL_APPLICATION_STATUSES] },
        },
        include: {
          applicant: {
            select: {
              name: true,
            },
          },
          position: {
            select: {
              title: true,
              interviewRequired: true,
              chapter: {
                select: {
                  name: true,
                },
              },
            },
          },
          interviewSlots: {
            orderBy: { scheduledAt: "asc" },
          },
          interviewNotes: {
            select: {
              recommendation: true,
            },
          },
          decision: {
            select: {
              accepted: true,
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      });

      for (const application of applications) {
        tasks.push(
          buildHiringInterviewTask({
            applicationId: application.id,
            applicantName: application.applicant.name || "Applicant",
            positionTitle: application.position.title,
            chapterName: application.position.chapter?.name || "Global",
            interviewRequired: application.position.interviewRequired,
            submittedAt: application.submittedAt,
            slots: application.interviewSlots,
            notes: application.interviewNotes,
            decisionAccepted: application.decision?.accepted ?? null,
            audience: "mine",
            viewerRole: "applicant",
          })
        );
      }
    } else if (isReviewer) {
      const where: Prisma.ApplicationWhereInput = {
        decision: null,
        status: { notIn: [...FINAL_APPLICATION_STATUSES] },
      };

      if (!isAdmin) {
        where.position = {
          chapterId: user.chapterId ?? "__no_chapter__",
        };
      }

      const applications = await prisma.application.findMany({
        where,
        include: {
          applicant: {
            select: {
              name: true,
            },
          },
          position: {
            select: {
              title: true,
              interviewRequired: true,
              chapter: {
                select: {
                  name: true,
                },
              },
            },
          },
          interviewSlots: {
            orderBy: { scheduledAt: "asc" },
          },
          interviewNotes: {
            select: {
              recommendation: true,
            },
          },
          decision: {
            select: {
              accepted: true,
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      });

      for (const application of applications) {
        tasks.push(
          buildHiringInterviewTask({
            applicationId: application.id,
            applicantName: application.applicant.name || "Applicant",
            positionTitle: application.position.title,
            chapterName: application.position.chapter?.name || "Global",
            interviewRequired: application.position.interviewRequired,
            submittedAt: application.submittedAt,
            slots: application.interviewSlots,
            notes: application.interviewNotes,
            decisionAccepted: application.decision?.accepted ?? null,
            audience: "team",
            viewerRole: "reviewer",
          })
        );
      }
    }
  }

  if (includeReadiness && canReadiness) {
    if (filters.view === "mine" && isInstructor) {
      const gate = await prisma.instructorInterviewGate.findUnique({
        where: { instructorId: input.userId },
        include: {
          slots: {
            orderBy: { scheduledAt: "asc" },
          },
          availabilityRequests: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
          },
          instructor: {
            select: {
              id: true,
              name: true,
              chapter: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (gate) {
        tasks.push(
          buildReadinessInterviewTask({
            gateId: gate.id,
            instructorId: gate.instructorId,
            instructorName: gate.instructor.name || "Instructor",
            chapterName: gate.instructor.chapter?.name || "No chapter",
            gateStatus: gate.status,
            outcome: gate.outcome,
            slots: gate.slots,
            pendingRequests: gate.availabilityRequests,
            audience: "mine",
            viewerRole: "instructor",
          })
        );
      } else {
        const myProfile = await prisma.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            name: true,
            chapter: { select: { name: true } },
          },
        });

        if (myProfile) {
          tasks.push(
            buildReadinessInterviewTask({
              gateId: `virtual-${myProfile.id}`,
              instructorId: myProfile.id,
              instructorName: myProfile.name || "Instructor",
              chapterName: myProfile.chapter?.name || "No chapter",
              gateStatus: "REQUIRED",
              outcome: null,
              slots: [],
              pendingRequests: [],
              audience: "mine",
              viewerRole: "instructor",
            })
          );
        }
      }
    } else if (filters.view === "team" && isReviewer) {
      const gates = await prisma.instructorInterviewGate.findMany({
        where: isAdmin
          ? undefined
          : {
              instructor: {
                chapterId: user.chapterId ?? "__no_chapter__",
              },
            },
        include: {
          instructor: {
            select: {
              id: true,
              name: true,
              chapter: {
                select: {
                  name: true,
                },
              },
            },
          },
          slots: {
            orderBy: { scheduledAt: "asc" },
          },
          availabilityRequests: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      for (const gate of gates) {
        tasks.push(
          buildReadinessInterviewTask({
            gateId: gate.id,
            instructorId: gate.instructorId,
            instructorName: gate.instructor.name || "Instructor",
            chapterName: gate.instructor.chapter?.name || "No chapter",
            gateStatus: gate.status,
            outcome: gate.outcome,
            slots: gate.slots,
            pendingRequests: gate.availabilityRequests,
            audience: "team",
            viewerRole: "reviewer",
          })
        );
      }
    }
  }

  const filtered = sortTasks(tasks).filter((task) => matchesInterviewState(task.stage, filters.state));

  const sections = {
    needsAction: filtered.filter((task) => task.stage === "NEEDS_ACTION"),
    scheduled: filtered.filter((task) => task.stage === "SCHEDULED"),
    completed: filtered.filter((task) => task.stage === "COMPLETED"),
    blocked: filtered.filter((task) => task.stage === "BLOCKED"),
  };

  return {
    filters,
    tasks: filtered,
    sections,
    viewer: {
      userId: input.userId,
      chapterId: user.chapterId,
      roles: input.roles,
      canTeamView,
    },
  };
}
