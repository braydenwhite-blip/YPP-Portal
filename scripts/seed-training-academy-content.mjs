import { PrismaClient, TrainingModuleType, VideoProvider } from "@prisma/client";

const prisma = new PrismaClient();

const academyModules = [
  {
    title: "Zoom Workshop: Teaching on YPP",
    description: "Live workshop on facilitation and engagement.",
    type: TrainingModuleType.WORKSHOP,
    required: true,
    sortOrder: 1,
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoProvider: VideoProvider.YOUTUBE,
    videoDuration: 900,
    requiresQuiz: true,
    requiresEvidence: false,
    passScorePct: 80,
    checkpoints: [
      {
        title: "Complete live workshop attendance",
        description: "Attend the full session and review facilitator notes.",
        sortOrder: 1,
        required: true,
      },
      {
        title: "Submit engagement reflection",
        description: "Write a short reflection on 2 strategies you will use in class.",
        sortOrder: 2,
        required: true,
      },
    ],
    quizQuestions: [
      {
        question: "What is the best first step when student energy drops mid-session?",
        options: [
          "Check in with a quick interactive reset",
          "Keep lecturing without pausing",
          "End class early",
        ],
        correctAnswer: "Check in with a quick interactive reset",
        sortOrder: 1,
      },
      {
        question: "Which approach best supports engagement in YPP classes?",
        options: [
          "Student voice and active practice",
          "One-way slides only",
          "Skipping check-ins",
        ],
        correctAnswer: "Student voice and active practice",
        sortOrder: 2,
      },
    ],
  },
  {
    title: "Situation Practice",
    description: "Scenario drills for student support and pacing.",
    type: TrainingModuleType.SCENARIO_PRACTICE,
    required: true,
    sortOrder: 2,
    videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    videoProvider: VideoProvider.YOUTUBE,
    videoDuration: 720,
    requiresQuiz: true,
    requiresEvidence: false,
    passScorePct: 80,
    checkpoints: [
      {
        title: "Practice student support scenarios",
        description: "Complete all listed classroom response drills.",
        sortOrder: 1,
        required: true,
      },
      {
        title: "Review pacing rubric",
        description: "Read and acknowledge the pacing standards guide.",
        sortOrder: 2,
        required: true,
      },
    ],
    quizQuestions: [
      {
        question: "If one student dominates discussion, what should you do first?",
        options: [
          "Invite quieter students with structured turns",
          "Ignore it completely",
          "Remove discussion entirely",
        ],
        correctAnswer: "Invite quieter students with structured turns",
        sortOrder: 1,
      },
      {
        question: "What pacing habit helps prevent student confusion?",
        options: [
          "Set a clear objective and recap transitions",
          "Rush through all activities",
          "Skip instructions",
        ],
        correctAnswer: "Set a clear objective and recap transitions",
        sortOrder: 2,
      },
    ],
  },
  {
    title: "Curriculum Review Capstone",
    description:
      "Align lesson plans with YPP standards and submit a capstone artifact.",
    type: TrainingModuleType.CURRICULUM_REVIEW,
    required: true,
    sortOrder: 3,
    videoUrl: null,
    videoProvider: null,
    videoDuration: null,
    requiresQuiz: false,
    requiresEvidence: true,
    passScorePct: 80,
    checkpoints: [
      {
        title: "Draft a standards-aligned class outline",
        description: "Prepare one full lesson outline aligned to YPP outcomes.",
        sortOrder: 1,
        required: true,
      },
      {
        title: "Complete capstone self-review",
        description: "Run your outline through the quality rubric before submission.",
        sortOrder: 2,
        required: true,
      },
    ],
    quizQuestions: [],
  },
];

async function upsertModule(definition) {
  const existing = await prisma.trainingModule.findFirst({
    where: { title: definition.title },
    select: { id: true },
  });

  if (existing) {
    return prisma.trainingModule.update({
      where: { id: existing.id },
      data: {
        description: definition.description,
        type: definition.type,
        required: definition.required,
        sortOrder: definition.sortOrder,
        videoUrl: definition.videoUrl,
        videoProvider: definition.videoProvider,
        videoDuration: definition.videoDuration,
        requiresQuiz: definition.requiresQuiz,
        requiresEvidence: definition.requiresEvidence,
        passScorePct: definition.passScorePct,
      },
    });
  }

  return prisma.trainingModule.create({
    data: {
      title: definition.title,
      description: definition.description,
      type: definition.type,
      required: definition.required,
      sortOrder: definition.sortOrder,
      videoUrl: definition.videoUrl,
      videoProvider: definition.videoProvider,
      videoDuration: definition.videoDuration,
      requiresQuiz: definition.requiresQuiz,
      requiresEvidence: definition.requiresEvidence,
      passScorePct: definition.passScorePct,
    },
  });
}

async function upsertCheckpoints(moduleId, checkpoints) {
  for (const checkpoint of checkpoints) {
    const existing = await prisma.trainingCheckpoint.findFirst({
      where: {
        moduleId,
        title: checkpoint.title,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.trainingCheckpoint.update({
        where: { id: existing.id },
        data: {
          description: checkpoint.description,
          sortOrder: checkpoint.sortOrder,
          required: checkpoint.required,
        },
      });
    } else {
      await prisma.trainingCheckpoint.create({
        data: {
          moduleId,
          title: checkpoint.title,
          description: checkpoint.description,
          sortOrder: checkpoint.sortOrder,
          required: checkpoint.required,
        },
      });
    }
  }
}

async function upsertQuizQuestions(moduleId, quizQuestions) {
  for (const question of quizQuestions) {
    const existing = await prisma.trainingQuizQuestion.findFirst({
      where: {
        moduleId,
        question: question.question,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.trainingQuizQuestion.update({
        where: { id: existing.id },
        data: {
          options: question.options,
          correctAnswer: question.correctAnswer,
          sortOrder: question.sortOrder,
        },
      });
    } else {
      await prisma.trainingQuizQuestion.create({
        data: {
          moduleId,
          question: question.question,
          options: question.options,
          correctAnswer: question.correctAnswer,
          sortOrder: question.sortOrder,
        },
      });
    }
  }
}

async function assignRequiredModulesToInstructors(moduleIds) {
  const instructors = await prisma.user.findMany({
    where: {
      roles: {
        some: { role: "INSTRUCTOR" },
      },
    },
    select: { id: true },
  });

  const assignments = [];
  for (const instructor of instructors) {
    for (const moduleId of moduleIds) {
      assignments.push({
        userId: instructor.id,
        moduleId,
        status: "NOT_STARTED",
      });
    }
  }

  if (assignments.length > 0) {
    await prisma.trainingAssignment.createMany({
      data: assignments,
      skipDuplicates: true,
    });
  }
}

async function main() {
  const requiredModuleIds = [];

  for (const definition of academyModules) {
    const module = await upsertModule(definition);
    requiredModuleIds.push(module.id);

    await upsertCheckpoints(module.id, definition.checkpoints);
    await upsertQuizQuestions(module.id, definition.quizQuestions);

    if (definition.requiresQuiz && definition.quizQuestions.length === 0) {
      throw new Error(
        `Module \"${definition.title}\" requires quiz but has no questions configured.`
      );
    }
  }

  await assignRequiredModulesToInstructors(requiredModuleIds);

  console.log("Training academy content seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
