export const MIN_CURRICULUM_OUTCOMES = 3;
export const MIN_ACTIVITIES_PER_SESSION = 3;
export const UNDERSTANDING_PASS_SCORE_PCT = 80;

export type StudioDifficultyLevel =
  | "LEVEL_101"
  | "LEVEL_201"
  | "LEVEL_301"
  | "LEVEL_401";

export type StudioDeliveryMode = "VIRTUAL" | "IN_PERSON" | "HYBRID";

export type StudioCourseConfig = {
  durationWeeks: number;
  sessionsPerWeek: number;
  classDurationMin: number;
  targetAgeGroup: string;
  deliveryModes: StudioDeliveryMode[];
  difficultyLevel: StudioDifficultyLevel;
  minStudents: number;
  maxStudents: number;
  idealSize: number;
  estimatedHours: number;
};

export const DEFAULT_COURSE_CONFIG: StudioCourseConfig = {
  durationWeeks: 8,
  sessionsPerWeek: 1,
  classDurationMin: 60,
  targetAgeGroup: "",
  deliveryModes: ["VIRTUAL"],
  difficultyLevel: "LEVEL_101",
  minStudents: 3,
  maxStudents: 25,
  idealSize: 12,
  estimatedHours: 8,
};

export const STUDIO_ACTIVITY_TYPES = [
  "WARM_UP",
  "INSTRUCTION",
  "PRACTICE",
  "DISCUSSION",
  "ASSESSMENT",
  "BREAK",
  "REFLECTION",
  "GROUP_WORK",
] as const;

export const STUDIO_AT_HOME_ASSIGNMENT_TYPES = [
  "REFLECTION_PROMPT",
  "PRACTICE_TASK",
  "QUIZ",
  "PRE_READING",
] as const;

export type StudioAtHomeAssignment = {
  type: (typeof STUDIO_AT_HOME_ASSIGNMENT_TYPES)[number];
  title: string;
  description: string;
};

export type StudioActivity = {
  id?: string;
  title?: string;
  type?: (typeof STUDIO_ACTIVITY_TYPES)[number];
  durationMin?: number;
  description?: string | null;
  resources?: string | null;
  notes?: string | null;
  materials?: string | null;
  differentiationTips?: string | null;
  energyLevel?: string | null;
  standardsTags?: string[];
  rubric?: string | null;
};

export type StudioSessionPlan = {
  id: string;
  weekNumber: number;
  sessionNumber: number;
  title: string;
  classDurationMin: number;
  activities: StudioActivity[];
  objective: string | null;
  teacherPrepNotes: string | null;
  materialsChecklist: string[];
  atHomeAssignment: StudioAtHomeAssignment | null;
};

export type StudioUnderstandingChecks = {
  answers: Record<string, string>;
  lastScorePct: number | null;
  passed: boolean;
  completedAt: string | null;
};

export type StudioReviewRubric = {
  scores: {
    clarity: number;
    sequencing: number;
    studentExperience: number;
    launchReadiness: number;
  };
  sectionNotes: {
    overview: string;
    courseStructure: string;
    sessionPlans: string;
    studentAssignments: string;
  };
  summary: string;
};

export type UnderstandingQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export const LESSON_DESIGN_UNDERSTANDING_QUESTIONS: UnderstandingQuestion[] = [
  {
    id: "objective_alignment",
    prompt: "What makes a strong class objective in this studio?",
    options: [
      "It names what students will be able to do by the end of the session.",
      "It lists every activity the instructor wants to cover.",
      "It repeats the course title in more formal language.",
      "It stays broad so the instructor can decide later.",
    ],
    correctAnswer:
      "It names what students will be able to do by the end of the session.",
    explanation:
      "Strong objectives focus on student learning, not the teacher's to-do list.",
  },
  {
    id: "session_pacing",
    prompt: "Why does the studio ask you to keep each session inside its time budget?",
    options: [
      "A realistic plan protects flow, transitions, and student energy in real teaching.",
      "Longer plans are always better because they show rigor.",
      "Time budgets only matter for printed exports.",
      "The budget is mostly decorative and does not affect teaching quality.",
    ],
    correctAnswer:
      "A realistic plan protects flow, transitions, and student energy in real teaching.",
    explanation:
      "A ready-to-teach session has pacing that can actually happen in the time students have.",
  },
  {
    id: "activity_sequence",
    prompt: "What is the best reason to sequence warm-up, instruction, practice, and reflection thoughtfully?",
    options: [
      "Students learn better when the session builds from entry, to understanding, to application, to closure.",
      "It makes the curriculum look more professional to reviewers, even if learning is unchanged.",
      "The order does not matter as long as every activity type appears once.",
      "Reflection should always come first so students can predict the lesson.",
    ],
    correctAnswer:
      "Students learn better when the session builds from entry, to understanding, to application, to closure.",
    explanation:
      "Sequence matters because students need a clear arc, not just a list of disconnected activities.",
  },
  {
    id: "homework_purpose",
    prompt: "What should an at-home assignment usually do in a strong first curriculum?",
    options: [
      "Extend or reinforce the learning from the session in a manageable way.",
      "Be as long as possible so students take the course seriously.",
      "Introduce brand-new material that was not covered in class.",
      "Stay generic so it can be reused every week without changes.",
    ],
    correctAnswer:
      "Extend or reinforce the learning from the session in a manageable way.",
    explanation:
      "Good at-home work deepens the lesson and feels achievable for students after class.",
  },
  {
    id: "example_usage",
    prompt: "How should instructors use the gold example curricula in this studio?",
    options: [
      "Study why they work, then adapt the moves to fit their own curriculum and students.",
      "Copy them exactly so every course follows the same plan.",
      "Read them only after the curriculum is already submitted.",
      "Ignore them if the topic is not an exact subject match.",
    ],
    correctAnswer:
      "Study why they work, then adapt the moves to fit their own curriculum and students.",
    explanation:
      "The examples are teaching tools. They model strong moves that should be translated, not duplicated blindly.",
  },
  {
    id: "course_outcomes",
    prompt: "Why does the studio ask for multiple course outcomes before submission?",
    options: [
      "Outcomes clarify what students should leave able to do, which helps the whole sequence stay coherent.",
      "Outcomes are mostly for decoration on the print export.",
      "Outcomes only matter if the course is longer than eight weeks.",
      "Outcomes are optional once the session titles are strong enough.",
    ],
    correctAnswer:
      "Outcomes clarify what students should leave able to do, which helps the whole sequence stay coherent.",
    explanation:
      "Good outcomes act like a map for the whole course. They help instructors make purposeful week-by-week choices.",
  },
  {
    id: "differentiation_use",
    prompt: "What is the best use of differentiation notes inside the studio?",
    options: [
      "They help the instructor plan how the same activity can still work for students who need more support or more challenge.",
      "They replace the main objective if the class is mixed ability.",
      "They are only needed for the reviewer and do not affect real teaching.",
      "They should be left blank unless the class already has formal accommodations.",
    ],
    correctAnswer:
      "They help the instructor plan how the same activity can still work for students who need more support or more challenge.",
    explanation:
      "Differentiation planning makes the lesson more teachable in real classrooms because students rarely learn at exactly the same pace or in the same way.",
  },
  {
    id: "capstone_goal",
    prompt: "What should a strong studio submission leave the instructor applicant with?",
    options: [
      "A full curriculum package that is ready for review and close to ready to teach, not just a rough outline.",
      "A promising topic idea that can be turned into a curriculum later.",
      "Only the first few sessions, as long as the remaining weeks are described briefly.",
      "A polished description page even if most of the session plans are unfinished.",
    ],
    correctAnswer:
      "A full curriculum package that is ready for review and close to ready to teach, not just a rough outline.",
    explanation:
      "The studio is designed so applicants leave training holding a real curriculum they can refine into launch, not an unfinished concept.",
  },
];

export type UnderstandingCheckResult = {
  correctCount: number;
  totalQuestions: number;
  scorePct: number;
  passed: boolean;
};

export type CurriculumDraftProgress = {
  totalSessionsExpected: number;
  totalSessionsConfigured: number;
  sessionsWithTitles: number;
  sessionsWithThreeActivities: number;
  sessionsWithObjectives: number;
  sessionsWithAtHomeAssignments: number;
  sessionsWithinTimeBudget: number;
  fullyBuiltSessions: number;
  hasFirstWeekWithThreeActivities: boolean;
  hasAnyObjective: boolean;
  hasAnyAtHomeAssignment: boolean;
  understandingChecksPassed: boolean;
  readyForSubmission: boolean;
  submissionIssues: string[];
};

function clampPositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.round(parsed));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => isNonEmptyString(item))
    : [];
}

export function getWeeklyPlansInput(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function isStudioActivityType(
  value: unknown
): value is (typeof STUDIO_ACTIVITY_TYPES)[number] {
  return STUDIO_ACTIVITY_TYPES.includes(
    String(value ?? "").trim().toUpperCase() as (typeof STUDIO_ACTIVITY_TYPES)[number]
  );
}

export function normalizeStudioActivityType(
  value: unknown
): (typeof STUDIO_ACTIVITY_TYPES)[number] {
  return isStudioActivityType(value)
    ? (String(value).trim().toUpperCase() as (typeof STUDIO_ACTIVITY_TYPES)[number])
    : "WARM_UP";
}

export function isStudioAtHomeAssignmentType(
  value: unknown
): value is (typeof STUDIO_AT_HOME_ASSIGNMENT_TYPES)[number] {
  return STUDIO_AT_HOME_ASSIGNMENT_TYPES.includes(
    String(value ?? "")
      .trim()
      .toUpperCase() as (typeof STUDIO_AT_HOME_ASSIGNMENT_TYPES)[number]
  );
}

export function normalizeStudioAtHomeAssignmentType(
  value: unknown
): (typeof STUDIO_AT_HOME_ASSIGNMENT_TYPES)[number] {
  return isStudioAtHomeAssignmentType(value)
    ? (String(value)
        .trim()
        .toUpperCase() as (typeof STUDIO_AT_HOME_ASSIGNMENT_TYPES)[number])
    : "REFLECTION_PROMPT";
}

function normalizeDeliveryModes(value: unknown): StudioDeliveryMode[] {
  const allowed: StudioDeliveryMode[] = ["VIRTUAL", "IN_PERSON", "HYBRID"];
  const modes = normalizeStringList(value).filter((mode): mode is StudioDeliveryMode =>
    allowed.includes(mode as StudioDeliveryMode)
  );
  return modes.length > 0 ? modes : DEFAULT_COURSE_CONFIG.deliveryModes;
}

function normalizeDifficultyLevel(value: unknown): StudioDifficultyLevel {
  const allowed: StudioDifficultyLevel[] = [
    "LEVEL_101",
    "LEVEL_201",
    "LEVEL_301",
    "LEVEL_401",
  ];
  return allowed.includes(value as StudioDifficultyLevel)
    ? (value as StudioDifficultyLevel)
    : DEFAULT_COURSE_CONFIG.difficultyLevel;
}

function normalizeAtHomeAssignment(value: unknown): StudioAtHomeAssignment | null {
  if (!value || typeof value !== "object") return null;

  const assignment = value as Record<string, unknown>;
  if (
    !isNonEmptyString(assignment.title) ||
    !isNonEmptyString(assignment.description) ||
    !isNonEmptyString(assignment.type)
  ) {
    return null;
  }

  return {
    type: normalizeStudioAtHomeAssignmentType(assignment.type),
    title: assignment.title,
    description: assignment.description,
  };
}

function normalizeActivity(value: unknown, index: number): StudioActivity {
  const activity = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: isNonEmptyString(activity.id) ? activity.id : `activity_${index + 1}`,
    title: isNonEmptyString(activity.title) ? activity.title : "",
    type: normalizeStudioActivityType(activity.type),
    durationMin: clampPositiveInteger(activity.durationMin, 10),
    description: isNonEmptyString(activity.description) ? activity.description : null,
    resources: isNonEmptyString(activity.resources) ? activity.resources : null,
    notes: isNonEmptyString(activity.notes) ? activity.notes : null,
    materials: isNonEmptyString(activity.materials) ? activity.materials : null,
    differentiationTips: isNonEmptyString(activity.differentiationTips)
      ? activity.differentiationTips
      : null,
    energyLevel: isNonEmptyString(activity.energyLevel) ? activity.energyLevel : null,
    standardsTags: normalizeStringList(activity.standardsTags),
    rubric: isNonEmptyString(activity.rubric) ? activity.rubric : null,
  };
}

function normalizePlanShape(
  value: unknown,
  courseConfig: StudioCourseConfig,
  index: number
): StudioSessionPlan {
  const plan = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const weekNumber = Math.floor(index / courseConfig.sessionsPerWeek) + 1;
  const sessionNumber = (index % courseConfig.sessionsPerWeek) + 1;

  return {
    id: isNonEmptyString(plan.id)
      ? plan.id
      : `session_${weekNumber}_${sessionNumber}`,
    weekNumber,
    sessionNumber,
    title: isNonEmptyString(plan.title) ? plan.title : "",
    classDurationMin: clampPositiveInteger(
      plan.classDurationMin,
      courseConfig.classDurationMin
    ),
    activities: Array.isArray(plan.activities)
      ? plan.activities.map((activity, activityIndex) =>
          normalizeActivity(activity, activityIndex)
        )
      : [],
    objective: isNonEmptyString(plan.objective) ? plan.objective : null,
    teacherPrepNotes: isNonEmptyString(plan.teacherPrepNotes)
      ? plan.teacherPrepNotes
      : null,
    materialsChecklist: normalizeStringList(plan.materialsChecklist),
    atHomeAssignment: normalizeAtHomeAssignment(plan.atHomeAssignment),
  };
}

export function normalizeCourseConfig(value: unknown): StudioCourseConfig {
  const config =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const durationWeeks = clampPositiveInteger(
    config.durationWeeks,
    DEFAULT_COURSE_CONFIG.durationWeeks
  );
  const sessionsPerWeek = clampPositiveInteger(
    config.sessionsPerWeek,
    DEFAULT_COURSE_CONFIG.sessionsPerWeek
  );
  const classDurationMin = clampPositiveInteger(
    config.classDurationMin,
    DEFAULT_COURSE_CONFIG.classDurationMin
  );
  const estimatedHoursFallback = Math.max(
    1,
    Math.round((durationWeeks * sessionsPerWeek * classDurationMin) / 60)
  );

  return {
    durationWeeks,
    sessionsPerWeek,
    classDurationMin,
    targetAgeGroup: isNonEmptyString(config.targetAgeGroup)
      ? config.targetAgeGroup
      : "",
    deliveryModes: normalizeDeliveryModes(config.deliveryModes),
    difficultyLevel: normalizeDifficultyLevel(config.difficultyLevel),
    minStudents: clampPositiveInteger(
      config.minStudents,
      DEFAULT_COURSE_CONFIG.minStudents
    ),
    maxStudents: clampPositiveInteger(
      config.maxStudents,
      DEFAULT_COURSE_CONFIG.maxStudents
    ),
    idealSize: clampPositiveInteger(
      config.idealSize,
      DEFAULT_COURSE_CONFIG.idealSize
    ),
    estimatedHours: clampPositiveInteger(config.estimatedHours, estimatedHoursFallback),
  };
}

export function getTotalSessionCount(courseConfig: StudioCourseConfig) {
  return courseConfig.durationWeeks * courseConfig.sessionsPerWeek;
}

export function getCourseConfigValidationIssues(
  courseConfig: StudioCourseConfig
) {
  const issues: string[] = [];

  if (courseConfig.minStudents > courseConfig.idealSize) {
    issues.push(
      "Set the minimum student count so it is not greater than the ideal class size."
    );
  }

  if (courseConfig.idealSize > courseConfig.maxStudents) {
    issues.push(
      "Set the ideal class size so it is not greater than the maximum student count."
    );
  }

  return issues;
}

export function syncSessionPlansToCourseConfig(
  rawPlans: unknown,
  rawCourseConfig: unknown
) {
  const courseConfig = normalizeCourseConfig(rawCourseConfig);
  const plans = getWeeklyPlansInput(rawPlans);
  const totalSessions = getTotalSessionCount(courseConfig);

  return Array.from({ length: totalSessions }, (_, index) =>
    normalizePlanShape(plans[index], courseConfig, index)
  );
}

export function normalizeUnderstandingChecks(
  value: unknown
): StudioUnderstandingChecks {
  const checks =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const answers: Record<string, string> =
    checks.answers && typeof checks.answers === "object"
      ? Object.fromEntries(
          Object.entries(checks.answers as Record<string, unknown>)
            .filter((entry) => isNonEmptyString(entry[1]))
            .map(([key, value]) => [key, String(value).trim()])
        ) as Record<string, string>
      : {};

  const lastScorePct =
    typeof checks.lastScorePct === "number" && Number.isFinite(checks.lastScorePct)
      ? Math.max(0, Math.min(100, Math.round(checks.lastScorePct)))
      : null;

  return {
    answers,
    lastScorePct,
    passed: checks.passed === true,
    completedAt: isNonEmptyString(checks.completedAt) ? checks.completedAt : null,
  };
}

export function emptyReviewRubric(): StudioReviewRubric {
  return {
    scores: {
      clarity: 0,
      sequencing: 0,
      studentExperience: 0,
      launchReadiness: 0,
    },
    sectionNotes: {
      overview: "",
      courseStructure: "",
      sessionPlans: "",
      studentAssignments: "",
    },
    summary: "",
  };
}

export function normalizeReviewRubric(value: unknown): StudioReviewRubric {
  const rubric =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const fallback = emptyReviewRubric();
  const rawScores =
    rubric.scores && typeof rubric.scores === "object"
      ? (rubric.scores as Record<string, unknown>)
      : {};
  const rawSectionNotes =
    rubric.sectionNotes && typeof rubric.sectionNotes === "object"
      ? (rubric.sectionNotes as Record<string, unknown>)
      : {};

  const normalizeScore = (score: unknown) => {
    const parsed = Number(score);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(4, Math.round(parsed)));
  };

  return {
    scores: {
      clarity: normalizeScore(rawScores.clarity),
      sequencing: normalizeScore(rawScores.sequencing),
      studentExperience: normalizeScore(rawScores.studentExperience),
      launchReadiness: normalizeScore(rawScores.launchReadiness),
    },
    sectionNotes: {
      overview: isNonEmptyString(rawSectionNotes.overview)
        ? rawSectionNotes.overview
        : fallback.sectionNotes.overview,
      courseStructure: isNonEmptyString(rawSectionNotes.courseStructure)
        ? rawSectionNotes.courseStructure
        : fallback.sectionNotes.courseStructure,
      sessionPlans: isNonEmptyString(rawSectionNotes.sessionPlans)
        ? rawSectionNotes.sessionPlans
        : fallback.sectionNotes.sessionPlans,
      studentAssignments: isNonEmptyString(rawSectionNotes.studentAssignments)
        ? rawSectionNotes.studentAssignments
        : fallback.sectionNotes.studentAssignments,
    },
    summary: isNonEmptyString(rubric.summary) ? rubric.summary : "",
  };
}

export function scoreUnderstandingChecks(
  answers: Record<string, string>
): UnderstandingCheckResult {
  const totalQuestions = LESSON_DESIGN_UNDERSTANDING_QUESTIONS.length;
  const correctCount = LESSON_DESIGN_UNDERSTANDING_QUESTIONS.filter(
    (question) => answers[question.id] === question.correctAnswer
  ).length;
  const scorePct =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    correctCount,
    totalQuestions,
    scorePct,
    passed: scorePct >= UNDERSTANDING_PASS_SCORE_PCT,
  };
}

export function buildUnderstandingChecksState(
  answers: Record<string, string>
): StudioUnderstandingChecks {
  const result = scoreUnderstandingChecks(answers);
  return {
    answers,
    lastScorePct: result.scorePct,
    passed: result.passed,
    completedAt: result.passed ? new Date().toISOString() : null,
  };
}

export function buildSessionLabel(
  plan: Pick<StudioSessionPlan, "weekNumber" | "sessionNumber">,
  courseConfig: StudioCourseConfig
) {
  return courseConfig.sessionsPerWeek > 1
    ? `Week ${plan.weekNumber} Session ${plan.sessionNumber}`
    : `Week ${plan.weekNumber}`;
}

export function buildWeeklyTopicsFromSessionPlans(
  rawPlans: unknown,
  rawCourseConfig: unknown
) {
  const courseConfig = normalizeCourseConfig(rawCourseConfig);
  const plans = syncSessionPlansToCourseConfig(rawPlans, courseConfig);

  return Array.from({ length: courseConfig.durationWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const weekSessions = plans.filter((plan) => plan.weekNumber === weekNumber);
    const sessionTitles = weekSessions
      .map((session) => session.title.trim())
      .filter((title): title is string => title.length > 0);
    const outcomes = Array.from(
      new Set(
        weekSessions
          .map((session) => session.objective?.trim())
          .filter((objective): objective is string => Boolean(objective))
      )
    );
    const homeworkTitles = weekSessions
      .map((session) => session.atHomeAssignment?.title?.trim())
      .filter((title): title is string => Boolean(title));

    return {
      week: weekNumber,
      topic:
        sessionTitles.length > 0
          ? sessionTitles.join(" / ")
          : `Week ${weekNumber}`,
      milestone:
        homeworkTitles.length > 0 ? homeworkTitles[homeworkTitles.length - 1] : null,
      outcomes,
    };
  });
}

export function getCurriculumDraftProgress(input: {
  title?: string;
  interestArea?: string;
  outcomes?: string[];
  weeklyPlans?: unknown;
  courseConfig?: unknown;
  understandingChecks?: unknown;
}): CurriculumDraftProgress {
  const courseConfig = normalizeCourseConfig(input.courseConfig);
  const sessionPlans = syncSessionPlansToCourseConfig(
    input.weeklyPlans,
    courseConfig
  );
  const understandingChecks = normalizeUnderstandingChecks(
    input.understandingChecks
  );
  const outcomes = Array.isArray(input.outcomes)
    ? input.outcomes.filter((outcome) => isNonEmptyString(outcome))
    : [];

  const sessionsWithTitles = sessionPlans.filter((plan) =>
    isNonEmptyString(plan.title)
  ).length;
  const sessionsWithThreeActivities = sessionPlans.filter(
    (plan) => plan.activities.length >= MIN_ACTIVITIES_PER_SESSION
  ).length;
  const sessionsWithObjectives = sessionPlans.filter((plan) =>
    isNonEmptyString(plan.objective)
  ).length;
  const sessionsWithAtHomeAssignments = sessionPlans.filter(
    (plan) => plan.atHomeAssignment !== null
  ).length;
  const sessionsWithinTimeBudget = sessionPlans.filter((plan) => {
    const totalMinutes = plan.activities.reduce(
      (sum, activity) => sum + clampPositiveInteger(activity.durationMin, 0),
      0
    );
    return totalMinutes > 0 && totalMinutes <= plan.classDurationMin;
  }).length;
  const fullyBuiltSessions = sessionPlans.filter((plan) => {
    const totalMinutes = plan.activities.reduce(
      (sum, activity) => sum + clampPositiveInteger(activity.durationMin, 0),
      0
    );
    return (
      isNonEmptyString(plan.title) &&
      isNonEmptyString(plan.objective) &&
      plan.activities.length >= MIN_ACTIVITIES_PER_SESSION &&
      plan.atHomeAssignment !== null &&
      totalMinutes > 0 &&
      totalMinutes <= plan.classDurationMin
    );
  }).length;

  const submissionIssues: string[] = [];
  const totalSessionsExpected = getTotalSessionCount(courseConfig);
  const courseConfigIssues = getCourseConfigValidationIssues(courseConfig);

  if (!isNonEmptyString(input.title)) {
    submissionIssues.push("Add a curriculum title.");
  }

  if (!isNonEmptyString(input.interestArea)) {
    submissionIssues.push("Choose an interest area.");
  }

  if (outcomes.length < MIN_CURRICULUM_OUTCOMES) {
    submissionIssues.push(
      `Add at least ${MIN_CURRICULUM_OUTCOMES} learning outcomes.`
    );
  }

  submissionIssues.push(...courseConfigIssues);

  if (sessionsWithTitles < totalSessionsExpected) {
    submissionIssues.push(
      `Give every session a clear title across all ${totalSessionsExpected} planned sessions.`
    );
  }

  if (sessionsWithObjectives < totalSessionsExpected) {
    submissionIssues.push(
      "Write a concrete objective for every session."
    );
  }

  if (sessionsWithThreeActivities < totalSessionsExpected) {
    submissionIssues.push(
      `Build each session with at least ${MIN_ACTIVITIES_PER_SESSION} activities.`
    );
  }

  if (sessionsWithAtHomeAssignments < totalSessionsExpected) {
    submissionIssues.push(
      "Add an at-home assignment to every session."
    );
  }

  if (sessionsWithinTimeBudget < totalSessionsExpected) {
    submissionIssues.push(
      "Make sure every session fits inside its class time budget."
    );
  }

  if (!understandingChecks.passed) {
    submissionIssues.push(
      `Pass the curriculum understanding check with at least ${UNDERSTANDING_PASS_SCORE_PCT}%.`
    );
  }

  return {
    totalSessionsExpected,
    totalSessionsConfigured: sessionPlans.length,
    sessionsWithTitles,
    sessionsWithThreeActivities,
    sessionsWithObjectives,
    sessionsWithAtHomeAssignments,
    sessionsWithinTimeBudget,
    fullyBuiltSessions,
    hasFirstWeekWithThreeActivities:
      sessionPlans[0]?.activities.length >= MIN_ACTIVITIES_PER_SESSION,
    hasAnyObjective: sessionsWithObjectives > 0,
    hasAnyAtHomeAssignment: sessionsWithAtHomeAssignments > 0,
    understandingChecksPassed: understandingChecks.passed,
    readyForSubmission: submissionIssues.length === 0,
    submissionIssues,
  };
}
