import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";

/** Sunday(0) … Saturday(6), matching `InstructorAvailability.weekday`. */
export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export type AvailabilityConflict = {
  weekday: number;
  offeringTitle: string;
  offeringId: string;
  meetingTime: string;
};

export async function getInstructorAvailability() {
  const user = await requireSessionUser();

  const [rows, classes] = await Promise.all([
    prisma.instructorAvailability.findMany({
      where: { userId: user.id },
      orderBy: { weekday: "asc" },
    }),
    prisma.classOffering.findMany({
      where: {
        OR: [{ instructorId: user.id }, { regularInstructorAssignments: { some: { instructorId: user.id } } }],
        endDate: { gte: new Date() },
      },
      select: { id: true, title: true, meetingDays: true, meetingTime: true },
    }),
  ]);

  const byWeekday = new Map(rows.map((r) => [r.weekday, r]));
  const unavailableWeekdays = new Set(
    rows.filter((r) => !r.available).map((r) => r.weekday)
  );

  // meetingDays is a string[] like ["Monday", "Wednesday"]; map to weekday ints.
  const dayNameToIndex = new Map(WEEKDAY_LABELS.map((name, idx) => [name.toLowerCase(), idx]));
  const conflicts: AvailabilityConflict[] = [];
  for (const offering of classes) {
    for (const dayName of offering.meetingDays) {
      const idx = dayNameToIndex.get(dayName.toLowerCase());
      if (idx === undefined) continue;
      if (unavailableWeekdays.has(idx)) {
        conflicts.push({
          weekday: idx,
          offeringTitle: offering.title,
          offeringId: offering.id,
          meetingTime: offering.meetingTime,
        });
      }
    }
  }

  const week = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    row: byWeekday.get(weekday) ?? null,
  }));

  return { user, week, conflicts };
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export type OnboardingStepKind = "derived" | "self-attest";

export type OnboardingStepDefinition = {
  key: string;
  title: string;
  description: string;
  kind: OnboardingStepKind;
  actionHref?: string;
  actionLabel?: string;
};

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    key: "profile-complete",
    title: "Complete your profile",
    description: "Add a bio so chapters and families can see who you are.",
    kind: "derived",
    actionHref: "/profile",
    actionLabel: "Edit profile",
  },
  {
    key: "policies-acknowledged",
    title: "Acknowledge instructor policies",
    description: "Confirm you've read the instructor conduct and safety policies.",
    kind: "self-attest",
  },
  {
    key: "training-prerequisites",
    title: "Complete required training",
    description: "Finish the instructor training track before your first class.",
    kind: "self-attest",
    actionHref: "/instructor-training",
    actionLabel: "Go to training",
  },
  {
    key: "availability-set",
    title: "Set your weekly availability",
    description: "Tell us which days and times you're available to teach.",
    kind: "derived",
    actionHref: "/instructor/availability",
    actionLabel: "Set availability",
  },
  {
    key: "first-class-readiness",
    title: "Complete a first-class readiness check",
    description: "Finish preparation for at least one upcoming session.",
    kind: "derived",
    actionHref: "/instructor/classes",
    actionLabel: "Go to classes",
  },
];

export type OnboardingStepState = OnboardingStepDefinition & {
  completed: boolean;
  completedAt: Date | null;
  note: string | null;
};

export async function getInstructorOnboarding() {
  const user = await requireSessionUser();

  const [tasks, profile, availabilityCount, preparedSession] = await Promise.all([
    prisma.instructorOnboardingTask.findMany({ where: { userId: user.id } }),
    prisma.userProfile.findUnique({ where: { userId: user.id }, select: { bio: true } }),
    prisma.instructorAvailability.count({ where: { userId: user.id } }),
    prisma.instructorSessionPreparation.findFirst({
      where: { instructorId: user.id, completedAt: { not: null } },
      select: { id: true },
    }),
  ]);

  const taskByKey = new Map(tasks.map((t) => [t.stepKey, t]));

  const derivedComplete: Record<string, boolean> = {
    "profile-complete": Boolean(profile?.bio && profile.bio.trim().length > 0),
    "availability-set": availabilityCount > 0,
    "first-class-readiness": Boolean(preparedSession),
  };

  const steps: OnboardingStepState[] = ONBOARDING_STEPS.map((def) => {
    const task = taskByKey.get(def.key);
    if (def.kind === "derived") {
      const completed = derivedComplete[def.key] ?? false;
      return { ...def, completed, completedAt: completed ? task?.completedAt ?? new Date() : null, note: task?.note ?? null };
    }
    return {
      ...def,
      completed: Boolean(task?.completedAt),
      completedAt: task?.completedAt ?? null,
      note: task?.note ?? null,
    };
  });

  const completedCount = steps.filter((s) => s.completed).length;

  return { user, steps, completedCount, totalCount: steps.length };
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export async function getInstructorTraining() {
  const user = await requireSessionUser();
  const certifications = await prisma.instructorCertification.findMany({
    where: { instructorId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return { user, certifications };
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

export async function getInstructorPerformance() {
  const user = await requireSessionUser();

  const offerings = await prisma.classOffering.findMany({
    where: {
      OR: [{ instructorId: user.id }, { regularInstructorAssignments: { some: { instructorId: user.id } } }],
    },
    select: { id: true },
  });
  const offeringIds = offerings.map((o) => o.id);

  const now = new Date();

  const [pastSessions, completedPreparations, certifications, growthEvents] = await Promise.all([
    prisma.classSession.findMany({
      where: { offeringId: { in: offeringIds }, date: { lt: now }, isCancelled: false },
      select: { id: true },
    }),
    prisma.instructorSessionPreparation.count({
      where: { instructorId: user.id, completedAt: { not: null } },
    }),
    prisma.instructorCertification.count({
      where: { instructorId: user.id, status: "CERTIFIED" },
    }).catch(() => 0),
    prisma.instructorGrowthEvent.findMany({
      where: { instructorId: user.id },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }).catch(() => []),
  ]);

  const pastSessionIds = new Set(pastSessions.map((s) => s.id));

  // Attendance completion: past sessions where every attendance record is finalized.
  const finalizedCountsBySession = await prisma.classAttendanceRecord.findMany({
    where: { sessionId: { in: [...pastSessionIds] } },
    select: { sessionId: true, finalizedAt: true },
  });
  const sessionFinalizeState = new Map<string, { total: number; finalized: number }>();
  for (const rec of finalizedCountsBySession) {
    const s = sessionFinalizeState.get(rec.sessionId) ?? { total: 0, finalized: 0 };
    s.total += 1;
    if (rec.finalizedAt) s.finalized += 1;
    sessionFinalizeState.set(rec.sessionId, s);
  }
  let sessionsFullyFinalized = 0;
  for (const sessionId of pastSessionIds) {
    const state = sessionFinalizeState.get(sessionId);
    if (state && state.total > 0 && state.finalized === state.total) sessionsFullyFinalized += 1;
  }

  const preparationRate = pastSessions.length > 0 ? completedPreparations / pastSessions.length : null;
  const attendanceCompletionRate = pastSessions.length > 0 ? sessionsFullyFinalized / pastSessions.length : null;

  return {
    user,
    pastSessionCount: pastSessions.length,
    completedPreparations,
    preparationRate,
    sessionsFullyFinalized,
    attendanceCompletionRate,
    certificationsEarned: certifications,
    growthEvents,
  };
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export const SUPPORT_CATEGORIES = [
  "LOGISTICS",
  "MATERIALS",
  "ROSTER",
  "SCHEDULING",
  "ATTENDANCE",
  "STUDENT_SUPPORT",
  "TECHNICAL",
] as const;

export const SUPPORT_CATEGORY_LABELS: Record<(typeof SUPPORT_CATEGORIES)[number], string> = {
  LOGISTICS: "Logistics",
  MATERIALS: "Materials",
  ROSTER: "Roster",
  SCHEDULING: "Scheduling",
  ATTENDANCE: "Attendance",
  STUDENT_SUPPORT: "Student support",
  TECHNICAL: "Technical",
};

export async function getInstructorSupportRequests() {
  const user = await requireSessionUser();
  const requests = await prisma.actionItem.findMany({
    where: { createdById: user.id, actionType: "INSTRUCTOR_SUPPORT" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return { user, requests };
}
