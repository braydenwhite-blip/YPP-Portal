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

async function main() {
  await ensureCircleMembers();
  await migrateLegacyFeedbackRequests();
  await migrateLegacyQuestions();
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
