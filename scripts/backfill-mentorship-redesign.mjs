import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function truncate(input, limit = 80) {
  const value = (input ?? "").trim();
  if (!value) return "Mentorship request";
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function mapLegacyStatus(status) {
  if (status === "ANSWERED") return "ANSWERED";
  if (status === "ARCHIVED") return "CLOSED";
  return "OPEN";
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getProgramGroupForRole(primaryRole) {
  if (primaryRole === "STUDENT") return "STUDENT";
  if (primaryRole === "INSTRUCTOR") return "INSTRUCTOR";
  return "OFFICER";
}

function getGovernanceModeForGroup(programGroup) {
  return programGroup === "STUDENT" ? "CONNECTED_STUDENT" : "FULL_PROGRAM";
}

function getCommitteeScopeForGroup(programGroup) {
  return programGroup === "INSTRUCTOR" ? "CHAPTER" : "GLOBAL";
}

function getAwardPolicyForGroup(programGroup) {
  return programGroup === "STUDENT"
    ? "STUDENT_RECOGNITION"
    : "ACHIEVEMENT_LADDER";
}

function getPointCategoryForGroup(programGroup) {
  if (programGroup === "STUDENT") return "STUDENT";
  if (programGroup === "INSTRUCTOR") return "INSTRUCTOR";
  return "GLOBAL_LEADERSHIP";
}

function getMentorshipTypeForGroup(programGroup) {
  return programGroup === "STUDENT" ? "STUDENT" : "INSTRUCTOR";
}

function getLegacyChairRoleType(primaryRole) {
  if (primaryRole === "INSTRUCTOR") return "INSTRUCTOR";
  if (primaryRole === "CHAPTER_LEAD") return "CHAPTER_PRESIDENT";
  return "GLOBAL_LEADERSHIP";
}

function getReflectionRoleType(primaryRole) {
  if (primaryRole === "INSTRUCTOR") return "INSTRUCTOR";
  if (primaryRole === "STUDENT") return "STUDENT";
  if (primaryRole === "CHAPTER_LEAD") return "CHAPTER_LEAD";
  return "ADMIN";
}

function getGoalReviewStatus(status) {
  if (status === "APPROVED") return "APPROVED";
  if (status === "PENDING_CHAIR_APPROVAL") return "PENDING_CHAIR_APPROVAL";
  if (status === "CHANGES_REQUESTED") return "RETURNED";
  return "DRAFT";
}

function getProgressStatusFromLegacyRating(rating) {
  if (rating === "BEHIND_SCHEDULE") return "BEHIND_SCHEDULE";
  if (rating === "GETTING_STARTED") return "GETTING_STARTED";
  if (rating === "ABOVE_AND_BEYOND") return "ABOVE_AND_BEYOND";
  return "ON_TRACK";
}

function getRecommendationStatus(status) {
  if (status === "APPROVED") return "APPROVED";
  if (status === "PENDING_BOARD") return "PENDING_BOARD_APPROVAL";
  if (status === "REJECTED") return "REJECTED";
  return "PENDING_CHAIR_APPROVAL";
}

const LEGACY_REFLECTION_TEMPLATE = [
  {
    key: "overallReflection",
    sectionTitle: "Overall Reflection",
    question: "How would you describe this month overall?",
    required: true,
  },
  {
    key: "engagementOverall",
    sectionTitle: "Engagement & Fulfillment",
    question: "How engaged and fulfilled did you feel this month?",
    required: true,
  },
  {
    key: "workingWell",
    sectionTitle: "Engagement & Fulfillment",
    question: "What worked well this month?",
    required: true,
  },
  {
    key: "supportNeeded",
    sectionTitle: "Engagement & Fulfillment",
    question: "What support do you need next?",
    required: true,
  },
  {
    key: "mentorHelpfulness",
    sectionTitle: "Engagement & Fulfillment",
    question: "How helpful has your mentor been this month?",
    required: true,
  },
  {
    key: "collaborationAssessment",
    sectionTitle: "Leadership Team Collaboration",
    question: "How would you describe your collaboration with the team?",
    required: true,
  },
  {
    key: "teamMembersAboveAndBeyond",
    sectionTitle: "Leadership Team Collaboration",
    question: "Who went above and beyond this month?",
    required: false,
  },
  {
    key: "collaborationImprovements",
    sectionTitle: "Leadership Team Collaboration",
    question: "What would improve collaboration next month?",
    required: false,
  },
  {
    key: "goalProgressSummaries",
    sectionTitle: "Goal Progress",
    question: "Goal progress summaries",
    required: false,
  },
  {
    key: "additionalReflections",
    sectionTitle: "Additional Reflections",
    question: "Anything else you want to reflect on?",
    required: false,
  },
];

const reflectionFormCache = new Map();
const canonicalTrackCache = new Map();
const legacyGoalCache = new Map();

async function ensureCanonicalTrackForMentorship(params) {
  const { primaryRole, chapterId = null, chapterName = null } = params;
  const programGroup = getProgramGroupForRole(primaryRole);
  const cacheKey = [
    programGroup,
    programGroup === "INSTRUCTOR" || programGroup === "STUDENT"
      ? chapterId ?? "global"
      : "global",
  ].join(":");

  if (canonicalTrackCache.has(cacheKey)) {
    return canonicalTrackCache.get(cacheKey);
  }

  const baseName =
    programGroup === "OFFICER"
      ? "Officer Mentorship"
      : programGroup === "INSTRUCTOR"
      ? "Instructor Mentorship"
      : "Student Mentorship";
  const scopedChapterId =
    programGroup === "INSTRUCTOR" || programGroup === "STUDENT" ? chapterId : null;
  const slug =
    scopedChapterId != null
      ? `${slugify(baseName)}-chapter-${scopedChapterId}`
      : `${slugify(baseName)}-global`;
  const name =
    scopedChapterId != null
      ? `${baseName} - ${chapterName ?? "Chapter"}`
      : `${baseName} - Global`;

  let track = await prisma.mentorshipTrack.findUnique({
    where: { slug },
  });

  if (!track) {
    track = await prisma.mentorshipTrack.create({
      data: {
        slug,
        name,
        description: `${name} canonical track`,
        scope:
          getCommitteeScopeForGroup(programGroup) === "CHAPTER"
            ? "CHAPTER"
            : "GLOBAL",
        chapterId: scopedChapterId,
        programGroup,
        governanceMode: getGovernanceModeForGroup(programGroup),
        committeeScope: getCommitteeScopeForGroup(programGroup),
        mentorCap: programGroup === "STUDENT" ? 6 : 3,
        awardPolicy: getAwardPolicyForGroup(programGroup),
        requiresQuarterlyReview: programGroup !== "STUDENT",
        pointCategory: getPointCategoryForGroup(programGroup),
      },
    });
  }

  canonicalTrackCache.set(cacheKey, track);
  return track;
}

async function resolveChairIdForMentorship(primaryRole, trackId) {
  if (trackId) {
    const track = await prisma.mentorshipTrack.findUnique({
      where: { id: trackId },
      select: {
        committees: {
          where: {
            chairUserId: {
              not: null,
            },
          },
          orderBy: { createdAt: "asc" },
          select: { chairUserId: true },
        },
      },
    });

    const committeeChairId = track?.committees[0]?.chairUserId ?? null;
    if (committeeChairId) {
      return committeeChairId;
    }
  }

  const chair = await prisma.mentorCommitteeChair.findFirst({
    where: {
      roleType: getLegacyChairRoleType(primaryRole),
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
    select: { userId: true },
  });

  return chair?.userId ?? null;
}

async function ensureLegacyReflectionForm(primaryRole, programGroup) {
  const roleType = getReflectionRoleType(primaryRole);
  const cacheKey = `${roleType}:${programGroup}`;
  if (reflectionFormCache.has(cacheKey)) {
    return reflectionFormCache.get(cacheKey);
  }

  const slug = `${slugify(roleType)}-${slugify(programGroup)}-legacy-reflection-import`;
  const title =
    programGroup === "STUDENT"
      ? "Student Mentorship Reflection"
      : programGroup === "INSTRUCTOR"
      ? "Instructor Mentorship Reflection"
      : "Officer Mentorship Reflection";

  let form = await prisma.reflectionForm.findFirst({
    where: {
      title,
      roleType,
      mentorshipProgramGroup: programGroup,
    },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!form) {
    form = await prisma.reflectionForm.create({
      data: {
        title,
        description: `Imported legacy mentorship reflection form (${slug}).`,
        roleType,
        mentorshipProgramGroup: programGroup,
        isActive: true,
        questions: {
          create: LEGACY_REFLECTION_TEMPLATE.map((question, index) => ({
            sectionTitle: question.sectionTitle,
            question: question.question,
            type: "TEXTAREA",
            options: [],
            required: question.required,
            sortOrder: index,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  reflectionFormCache.set(cacheKey, form);
  return form;
}

function buildGoalProgressSummary(goalResponses) {
  if (!goalResponses.length) {
    return "";
  }

  return goalResponses
    .map((goalResponse) =>
      [
        goalResponse.goal?.title ? `Goal: ${goalResponse.goal.title}` : "Goal",
        `Progress made: ${goalResponse.progressMade}`,
        `Objective achieved: ${goalResponse.objectiveAchieved ? "Yes" : "No"}`,
        `Accomplishments: ${goalResponse.accomplishments}`,
        goalResponse.blockers ? `Blockers: ${goalResponse.blockers}` : null,
        `Next month plans: ${goalResponse.nextMonthPlans}`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

async function ensureCanonicalGoalForLegacyGoal(params) {
  const { legacyGoal, userId, primaryRole, programGroup } = params;
  const cacheKey = `${legacyGoal.id}:${userId}:${primaryRole}:${programGroup}`;
  if (legacyGoalCache.has(cacheKey)) {
    return legacyGoalCache.get(cacheKey);
  }

  const existingGoal = await prisma.goal.findFirst({
    where: {
      userId,
      template: {
        title: legacyGoal.title,
      },
    },
    select: { id: true },
  });

  if (existingGoal) {
    legacyGoalCache.set(cacheKey, existingGoal.id);
    return existingGoal.id;
  }

  let template = await prisma.goalTemplate.findFirst({
    where: {
      title: legacyGoal.title,
      roleType: primaryRole,
      mentorshipProgramGroup: programGroup,
    },
  });

  if (!template) {
    template = await prisma.goalTemplate.create({
      data: {
        title: legacyGoal.title,
        description: legacyGoal.description ?? null,
        roleType: primaryRole,
        mentorshipProgramGroup: programGroup,
        sortOrder: legacyGoal.sortOrder ?? 0,
        isActive: legacyGoal.isActive ?? true,
      },
    });
  }

  const goal = await prisma.goal.create({
    data: {
      userId,
      templateId: template.id,
    },
    select: { id: true },
  });

  legacyGoalCache.set(cacheKey, goal.id);
  return goal.id;
}

async function ensureCircleMembers() {
  const mentorships = await prisma.mentorship.findMany({
    include: {
      mentee: { select: { id: true } },
      mentor: { select: { id: true } },
      chair: { select: { id: true } },
    },
  });

  for (const mentorship of mentorships) {
    await prisma.mentorshipCircleMember.upsert({
      where: {
        menteeId_userId_role: {
          menteeId: mentorship.menteeId,
          userId: mentorship.mentorId,
          role: "PRIMARY_MENTOR",
        },
      },
      update: {
        mentorshipId: mentorship.id,
        isPrimary: true,
        isActive: mentorship.status === "ACTIVE",
        source: "MENTORSHIP_BACKFILL",
      },
      create: {
        id: `support-primary-${mentorship.id}`,
        mentorshipId: mentorship.id,
        menteeId: mentorship.menteeId,
        userId: mentorship.mentorId,
        role: "PRIMARY_MENTOR",
        source: "MENTORSHIP_BACKFILL",
        isPrimary: true,
        isActive: mentorship.status === "ACTIVE",
      },
    });

    if (mentorship.chairId) {
      await prisma.mentorshipCircleMember.upsert({
        where: {
          menteeId_userId_role: {
            menteeId: mentorship.menteeId,
            userId: mentorship.chairId,
            role: "CHAIR",
          },
        },
        update: {
          mentorshipId: mentorship.id,
          isActive: mentorship.status === "ACTIVE",
          source: "MENTORSHIP_BACKFILL",
        },
        create: {
          id: `support-chair-${mentorship.id}`,
          mentorshipId: mentorship.id,
          menteeId: mentorship.menteeId,
          userId: mentorship.chairId,
          role: "CHAIR",
          source: "MENTORSHIP_BACKFILL",
          isActive: mentorship.status === "ACTIVE",
        },
      });
    }
  }

  const advisorships = await prisma.collegeAdvisorship.findMany({
    include: {
      advisor: { select: { userId: true } },
    },
  });

  for (const advisorship of advisorships) {
    const activeMentorship = await prisma.mentorship.findFirst({
      where: {
        menteeId: advisorship.adviseeId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await prisma.mentorshipCircleMember.upsert({
      where: {
        menteeId_userId_role: {
          menteeId: advisorship.adviseeId,
          userId: advisorship.advisor.userId,
          role: "COLLEGE_ADVISOR",
        },
      },
      update: {
        mentorshipId: activeMentorship?.id ?? null,
        notes: advisorship.notes ?? null,
        isActive: advisorship.endDate == null,
        source: "COLLEGE_ADVISOR_BACKFILL",
      },
      create: {
        id: `support-college-${advisorship.id}`,
        mentorshipId: activeMentorship?.id ?? null,
        menteeId: advisorship.adviseeId,
        userId: advisorship.advisor.userId,
        role: "COLLEGE_ADVISOR",
        source: "COLLEGE_ADVISOR_BACKFILL",
        notes: advisorship.notes ?? null,
        isActive: advisorship.endDate == null,
      },
    });
  }
}

async function migrateLegacyFeedbackRequests() {
  const requests = await prisma.mentorFeedbackRequest.findMany({
    include: {
      student: { select: { id: true } },
      responses: {
        include: {
          mentor: { select: { id: true, name: true } },
        },
      },
    },
  });

  for (const request of requests) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        menteeId: request.studentId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        trackId: true,
        mentorId: true,
      },
    });

    await prisma.mentorshipRequest.upsert({
      where: { id: `legacy-feedback-${request.id}` },
      update: {
        mentorshipId: mentorship?.id ?? null,
        trackId: mentorship?.trackId ?? null,
        assignedToId: mentorship?.mentorId ?? null,
        status: mapLegacyStatus(request.status),
        title: truncate(request.question),
        details: request.question,
        isAnonymous: false,
        passionId: request.passionId,
        projectId: request.projectId ?? null,
      },
      create: {
        id: `legacy-feedback-${request.id}`,
        mentorshipId: mentorship?.id ?? null,
        menteeId: request.studentId,
        requesterId: request.studentId,
        assignedToId: mentorship?.mentorId ?? null,
        trackId: mentorship?.trackId ?? null,
        kind: "PROJECT_FEEDBACK",
        visibility: "PRIVATE",
        status: mapLegacyStatus(request.status),
        title: truncate(request.question),
        details: request.question,
        isAnonymous: false,
        passionId: request.passionId,
        projectId: request.projectId ?? null,
        requestedAt: request.createdAt,
      },
    });

    for (const response of request.responses) {
      await prisma.mentorshipRequestResponse.upsert({
        where: { id: `legacy-feedback-response-${response.id}` },
        update: {
          body: response.feedback,
          videoUrl: response.videoUrl ?? null,
          resourceLinks: response.resources,
          isHelpful: response.isHelpful ?? null,
          helpfulCount: response.isHelpful ? 1 : 0,
        },
        create: {
          id: `legacy-feedback-response-${response.id}`,
          requestId: `legacy-feedback-${request.id}`,
          responderId: response.mentorId,
          body: response.feedback,
          videoUrl: response.videoUrl ?? null,
          resourceLinks: response.resources,
          isHelpful: response.isHelpful ?? null,
          helpfulCount: response.isHelpful ? 1 : 0,
          createdAt: response.respondedAt,
          updatedAt: response.respondedAt,
        },
      });

      for (const [index, url] of response.resources.entries()) {
        await prisma.mentorshipResource.upsert({
          where: { id: `legacy-feedback-resource-${response.id}-${index}` },
          update: {
            url,
            passionId: request.passionId,
            isPublished: false,
          },
          create: {
            id: `legacy-feedback-resource-${response.id}-${index}`,
            mentorshipId: mentorship?.id ?? null,
            menteeId: request.studentId,
            requestId: `legacy-feedback-${request.id}`,
            responseId: `legacy-feedback-response-${response.id}`,
            trackId: mentorship?.trackId ?? null,
            createdById: response.mentorId,
            type: "LINK",
            title: `Resource from ${response.mentor.name}`,
            description: "Imported from a legacy mentor feedback response.",
            url,
            passionId: request.passionId,
            isFeatured: false,
            isPublished: false,
            createdAt: response.respondedAt,
            updatedAt: response.respondedAt,
          },
        });
      }
    }
  }
}

async function migrateLegacyQuestions() {
  const questions = await prisma.mentorQuestion.findMany({
    include: {
      answers: {
        include: {
          mentor: { select: { id: true, name: true } },
        },
      },
    },
  });

  for (const question of questions) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        menteeId: question.studentId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        trackId: true,
      },
    });

    await prisma.mentorshipRequest.upsert({
      where: { id: `legacy-question-${question.id}` },
      update: {
        mentorshipId: mentorship?.id ?? null,
        trackId: mentorship?.trackId ?? null,
        status: question.answers.length > 0 ? "ANSWERED" : mapLegacyStatus(question.status),
        title: truncate(question.question),
        details: question.question,
        isAnonymous: question.isAnonymous,
        passionId: question.passionId ?? null,
      },
      create: {
        id: `legacy-question-${question.id}`,
        mentorshipId: mentorship?.id ?? null,
        menteeId: question.studentId,
        requesterId: question.studentId,
        assignedToId: null,
        trackId: mentorship?.trackId ?? null,
        kind: "GENERAL_QNA",
        visibility: "PUBLIC",
        status: question.answers.length > 0 ? "ANSWERED" : mapLegacyStatus(question.status),
        title: truncate(question.question),
        details: question.question,
        isAnonymous: question.isAnonymous,
        passionId: question.passionId ?? null,
        requestedAt: question.createdAt,
      },
    });

    for (const answer of question.answers) {
      await prisma.mentorshipRequestResponse.upsert({
        where: { id: `legacy-question-answer-${answer.id}` },
        update: {
          body: answer.answer,
          videoUrl: answer.videoUrl ?? null,
          helpfulCount: answer.helpful,
        },
        create: {
          id: `legacy-question-answer-${answer.id}`,
          requestId: `legacy-question-${question.id}`,
          responderId: answer.mentorId,
          body: answer.answer,
          videoUrl: answer.videoUrl ?? null,
          helpfulCount: answer.helpful,
          createdAt: answer.answeredAt,
          updatedAt: answer.answeredAt,
        },
      });

      await prisma.mentorshipResource.upsert({
        where: { id: `legacy-question-resource-${answer.id}` },
        update: {
          body: answer.answer,
          passionId: question.passionId ?? null,
          isPublished: true,
        },
        create: {
          id: `legacy-question-resource-${answer.id}`,
          mentorshipId: mentorship?.id ?? null,
          menteeId: question.studentId,
          requestId: `legacy-question-${question.id}`,
          responseId: `legacy-question-answer-${answer.id}`,
          trackId: mentorship?.trackId ?? null,
          createdById: answer.mentorId,
          type: "ANSWER",
          title: truncate(question.question),
          description: "Imported from the legacy Ask a Mentor knowledge base.",
          body: answer.answer,
          passionId: question.passionId ?? null,
          isFeatured: answer.helpful >= 2,
          isPublished: true,
          createdAt: answer.answeredAt,
          updatedAt: answer.answeredAt,
        },
      });
    }
  }
}

async function backfillCanonicalMentorshipContext() {
  const mentorships = await prisma.mentorship.findMany({
    include: {
      mentee: {
        select: {
          primaryRole: true,
          chapterId: true,
          chapter: { select: { name: true } },
        },
      },
    },
  });

  for (const mentorship of mentorships) {
    const programGroup = getProgramGroupForRole(mentorship.mentee.primaryRole);
    const track =
      mentorship.trackId != null
        ? await prisma.mentorshipTrack.findUnique({
            where: { id: mentorship.trackId },
          })
        : await ensureCanonicalTrackForMentorship({
            primaryRole: mentorship.mentee.primaryRole,
            chapterId: mentorship.mentee.chapterId,
            chapterName: mentorship.mentee.chapter?.name ?? null,
          });
    const resolvedTrack =
      track ??
      (await ensureCanonicalTrackForMentorship({
        primaryRole: mentorship.mentee.primaryRole,
        chapterId: mentorship.mentee.chapterId,
        chapterName: mentorship.mentee.chapter?.name ?? null,
      }));
    const chairId =
      mentorship.chairId ??
      (await resolveChairIdForMentorship(
        mentorship.mentee.primaryRole,
        resolvedTrack.id
      ));

    await prisma.mentorship.update({
      where: { id: mentorship.id },
      data: {
        type: getMentorshipTypeForGroup(programGroup),
        programGroup,
        governanceMode: getGovernanceModeForGroup(programGroup),
        trackId: resolvedTrack.id,
        chairId,
      },
    });
  }
}

async function migrateLegacyProgramReviews() {
  const legacyReflections = await prisma.monthlySelfReflection.findMany({
    include: {
      mentee: {
        select: {
          id: true,
          primaryRole: true,
        },
      },
      mentorship: {
        include: {
          track: true,
        },
      },
      goalResponses: {
        include: {
          goal: true,
        },
      },
      goalReview: {
        include: {
          goalRatings: {
            include: {
              goal: true,
            },
          },
          pointLog: true,
        },
      },
    },
    orderBy: [{ cycleMonth: "asc" }, { createdAt: "asc" }],
  });

  for (const reflection of legacyReflections) {
    const programGroup =
      reflection.mentorship.programGroup ??
      getProgramGroupForRole(reflection.mentee.primaryRole);
    const track =
      reflection.mentorship.track ??
      (await ensureCanonicalTrackForMentorship({
        primaryRole: reflection.mentee.primaryRole,
      }));
    const form = await ensureLegacyReflectionForm(
      reflection.mentee.primaryRole,
      programGroup
    );
    const goalProgressSummary = buildGoalProgressSummary(reflection.goalResponses);
    const responseValues = {
      overallReflection: reflection.overallReflection,
      engagementOverall: reflection.engagementOverall,
      workingWell: reflection.workingWell,
      supportNeeded: reflection.supportNeeded,
      mentorHelpfulness: reflection.mentorHelpfulness,
      collaborationAssessment: reflection.collaborationAssessment,
      teamMembersAboveAndBeyond: reflection.teamMembersAboveAndBeyond ?? "",
      collaborationImprovements: reflection.collaborationImprovements ?? "",
      goalProgressSummaries: goalProgressSummary,
      additionalReflections: reflection.additionalReflections ?? "",
    };

    await prisma.reflectionSubmission.upsert({
      where: { id: `legacy-reflection-${reflection.id}` },
      update: {
        userId: reflection.menteeId,
        formId: form.id,
        month: reflection.cycleMonth,
        submittedAt: reflection.submittedAt,
        responses: {
          deleteMany: {},
          create: form.questions
            .map((question) => ({
              questionId: question.id,
              value: responseValues[
                LEGACY_REFLECTION_TEMPLATE[question.sortOrder]?.key
              ],
            }))
            .filter((response) => (response.value ?? "").trim() !== ""),
        },
      },
      create: {
        id: `legacy-reflection-${reflection.id}`,
        userId: reflection.menteeId,
        formId: form.id,
        month: reflection.cycleMonth,
        submittedAt: reflection.submittedAt,
        responses: {
          create: form.questions
            .map((question) => ({
              questionId: question.id,
              value: responseValues[
                LEGACY_REFLECTION_TEMPLATE[question.sortOrder]?.key
              ],
            }))
            .filter((response) => (response.value ?? "").trim() !== ""),
        },
      },
    });

    if (!reflection.goalReview) {
      continue;
    }

    const canonicalReview = await prisma.monthlyGoalReview.upsert({
      where: {
        mentorshipId_month: {
          mentorshipId: reflection.mentorshipId,
          month: reflection.cycleMonth,
        },
      },
      update: {
        trackId: track.id,
        menteeId: reflection.menteeId,
        mentorId: reflection.goalReview.mentorId,
        chairId: reflection.goalReview.chairReviewerId ?? reflection.mentorship.chairId,
        reflectionSubmissionId: `legacy-reflection-${reflection.id}`,
        requiresChairApproval:
          getGovernanceModeForGroup(programGroup) === "FULL_PROGRAM",
        status: getGoalReviewStatus(reflection.goalReview.status),
        overallStatus: getProgressStatusFromLegacyRating(
          reflection.goalReview.overallRating
        ),
        overallComments: reflection.goalReview.overallComments,
        focusAreas: reflection.goalReview.projectedFuturePath ?? null,
        promotionReadiness: reflection.goalReview.promotionReadiness ?? null,
        nextMonthPlan: reflection.goalReview.planOfAction,
        chairDecisionNotes: reflection.goalReview.chairComments ?? null,
        baseAchievementPoints: reflection.goalReview.pointsAwarded ?? 0,
        totalAchievementPoints: reflection.goalReview.pointsAwarded ?? 0,
        mentorSubmittedAt: reflection.goalReview.createdAt,
        chairDecisionAt: reflection.goalReview.chairApprovedAt ?? null,
        publishedAt:
          reflection.goalReview.releasedToMenteeAt ??
          reflection.goalReview.chairApprovedAt ??
          null,
      },
      create: {
        id: `legacy-review-${reflection.goalReview.id}`,
        mentorshipId: reflection.mentorshipId,
        trackId: track.id,
        menteeId: reflection.menteeId,
        mentorId: reflection.goalReview.mentorId,
        chairId: reflection.goalReview.chairReviewerId ?? reflection.mentorship.chairId,
        reflectionSubmissionId: `legacy-reflection-${reflection.id}`,
        month: reflection.cycleMonth,
        requiresChairApproval:
          getGovernanceModeForGroup(programGroup) === "FULL_PROGRAM",
        status: getGoalReviewStatus(reflection.goalReview.status),
        overallStatus: getProgressStatusFromLegacyRating(
          reflection.goalReview.overallRating
        ),
        overallComments: reflection.goalReview.overallComments,
        focusAreas: reflection.goalReview.projectedFuturePath ?? null,
        promotionReadiness: reflection.goalReview.promotionReadiness ?? null,
        nextMonthPlan: reflection.goalReview.planOfAction,
        chairDecisionNotes: reflection.goalReview.chairComments ?? null,
        baseAchievementPoints: reflection.goalReview.pointsAwarded ?? 0,
        totalAchievementPoints: reflection.goalReview.pointsAwarded ?? 0,
        mentorSubmittedAt: reflection.goalReview.createdAt,
        chairDecisionAt: reflection.goalReview.chairApprovedAt ?? null,
        publishedAt:
          reflection.goalReview.releasedToMenteeAt ??
          reflection.goalReview.chairApprovedAt ??
          null,
      },
      select: { id: true },
    });

    await prisma.monthlyGoalRating.deleteMany({
      where: { reviewId: canonicalReview.id },
    });

    for (const rating of reflection.goalReview.goalRatings) {
      const canonicalGoalId = await ensureCanonicalGoalForLegacyGoal({
        legacyGoal: rating.goal,
        userId: reflection.menteeId,
        primaryRole: reflection.mentee.primaryRole,
        programGroup,
      });

      await prisma.monthlyGoalRating.create({
        data: {
          reviewId: canonicalReview.id,
          goalId: canonicalGoalId,
          status: getProgressStatusFromLegacyRating(rating.rating),
          comments: rating.comments ?? null,
        },
      });
    }

    if ((reflection.goalReview.pointsAwarded ?? 0) > 0) {
      await prisma.achievementPointLedger.upsert({
        where: { reviewId: canonicalReview.id },
        update: {
          userId: reflection.menteeId,
          points: reflection.goalReview.pointsAwarded,
          category: track.pointCategory,
          reason:
            reflection.goalReview.pointLog?.reason ??
            `Imported legacy monthly goal review for ${reflection.cycleMonth.toISOString().slice(0, 7)}`,
          approvedById: reflection.goalReview.chairReviewerId ?? null,
        },
        create: {
          userId: reflection.menteeId,
          reviewId: canonicalReview.id,
          points: reflection.goalReview.pointsAwarded,
          category: track.pointCategory,
          reason:
            reflection.goalReview.pointLog?.reason ??
            `Imported legacy monthly goal review for ${reflection.cycleMonth.toISOString().slice(0, 7)}`,
          approvedById: reflection.goalReview.chairReviewerId ?? null,
          createdAt:
            reflection.goalReview.chairApprovedAt ??
            reflection.goalReview.updatedAt,
        },
      });
    }
  }
}

async function migrateLegacyAwardRecommendations() {
  const nominations = await prisma.awardNomination.findMany({
    include: {
      nominee: {
        select: {
          id: true,
        },
      },
    },
  });

  for (const nomination of nominations) {
    const activeMentorship = await prisma.mentorship.findFirst({
      where: {
        menteeId: nomination.nomineeId,
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      select: {
        trackId: true,
      },
    });

    await prisma.mentorshipAwardRecommendation.upsert({
      where: { id: `legacy-award-${nomination.id}` },
      update: {
        userId: nomination.nomineeId,
        trackId: activeMentorship?.trackId ?? null,
        level: nomination.tier,
        status: getRecommendationStatus(nomination.status),
        notes: nomination.notes ?? null,
        recommendedById: nomination.nominatedBy,
        approvedById:
          nomination.boardApproverId ??
          nomination.chairApproverId ??
          null,
      },
      create: {
        id: `legacy-award-${nomination.id}`,
        userId: nomination.nomineeId,
        trackId: activeMentorship?.trackId ?? null,
        level: nomination.tier,
        status: getRecommendationStatus(nomination.status),
        notes: nomination.notes ?? null,
        recommendedById: nomination.nominatedBy,
        approvedById:
          nomination.boardApproverId ??
          nomination.chairApproverId ??
          null,
        createdAt: nomination.createdAt,
        updatedAt: nomination.updatedAt,
      },
    });
  }
}

async function main() {
  await backfillCanonicalMentorshipContext();
  await ensureCircleMembers();
  await migrateLegacyFeedbackRequests();
  await migrateLegacyQuestions();
  await migrateLegacyProgramReviews();
  await migrateLegacyAwardRecommendations();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Failed to backfill mentorship redesign data:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
