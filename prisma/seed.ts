import { PrismaClient, CourseFormat, CourseLevel, TrainingModuleType, RoleType, MentorshipType, EventType, FeedbackSource, TrainingStatus, ApprovalStatus, VideoProvider, PassionCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error("SEED_PASSWORD environment variable is required. Set it before running seed.");
  }
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const frisch = await prisma.chapter.create({
    data: {
      name: "The Frisch School",
      city: "New York",
      region: "Northeast"
    }
  });

  const boston = await prisma.chapter.create({
    data: {
      name: "Boston Chapter",
      city: "Boston",
      region: "Northeast"
    }
  });

  const admin = await prisma.user.create({
    data: {
      name: "Brayden White",
      email: "brayden.white@youthpassionproject.org",
      phone: "(917)-538-6197",
      passwordHash,
      primaryRole: RoleType.ADMIN,
      chapterId: frisch.id,
      roles: {
        create: [{ role: RoleType.ADMIN }, { role: RoleType.INSTRUCTOR }]
      }
    }
  });

  const mentor = await prisma.user.create({
    data: {
      name: "Carly Gelles",
      email: "carlygelles@gmail.com",
      phone: "(914)-907-1779",
      passwordHash,
      primaryRole: RoleType.MENTOR,
      chapterId: boston.id,
      roles: {
        create: [{ role: RoleType.MENTOR }, { role: RoleType.STAFF }]
      }
    }
  });

  const instructor = await prisma.user.create({
    data: {
      name: "Avery Lin",
      email: "avery.lin@youthpassionproject.org",
      phone: "(646)-555-0127",
      passwordHash,
      primaryRole: RoleType.INSTRUCTOR,
      chapterId: frisch.id,
      roles: {
        create: [{ role: RoleType.INSTRUCTOR }]
      }
    }
  });

  const student = await prisma.user.create({
    data: {
      name: "Jordan Patel",
      email: "jordan.patel@youthpassionproject.org",
      phone: "(347)-555-3391",
      passwordHash,
      primaryRole: RoleType.STUDENT,
      chapterId: frisch.id,
      roles: {
        create: [{ role: RoleType.STUDENT }]
      }
    }
  });

  const oneOff = await prisma.course.create({
    data: {
      title: "Intro to Forensic Psychology",
      description: "One-off exploration class to spark curiosity.",
      format: CourseFormat.ONE_OFF,
      interestArea: "Psychology",
      chapterId: frisch.id,
      leadInstructorId: instructor.id
    }
  });

  const course101 = await prisma.course.create({
    data: {
      title: "Psychology Foundations 101",
      description: "Foundational concepts, vocabulary, and core methods.",
      format: CourseFormat.LEVELED,
      level: CourseLevel.LEVEL_101,
      interestArea: "Psychology",
      chapterId: frisch.id,
      leadInstructorId: instructor.id
    }
  });

  const course201 = await prisma.course.create({
    data: {
      title: "Psychology Inquiry 201",
      description: "Intermediate research design and applied studies.",
      format: CourseFormat.LEVELED,
      level: CourseLevel.LEVEL_201,
      interestArea: "Psychology",
      chapterId: frisch.id,
      leadInstructorId: instructor.id
    }
  });

  const course301 = await prisma.course.create({
    data: {
      title: "Psychology Lab 301",
      description: "Advanced projects, mentorship, and independent inquiry.",
      format: CourseFormat.LEVELED,
      level: CourseLevel.LEVEL_301,
      interestArea: "Psychology",
      chapterId: frisch.id,
      leadInstructorId: instructor.id
    }
  });

  const lab = await prisma.course.create({
    data: {
      title: "Passion Lab: Behavioral Research",
      description: "Project-based, in-person-first lab with showcase.",
      format: CourseFormat.LAB,
      interestArea: "Psychology",
      chapterId: frisch.id,
      leadInstructorId: instructor.id
    }
  });

  const commons = await prisma.course.create({
    data: {
      title: "The Commons: Research Studio",
      description: "Advanced mentored practice after labs.",
      format: CourseFormat.COMMONS,
      interestArea: "Psychology",
      isVirtual: true,
      chapterId: frisch.id,
      leadInstructorId: instructor.id
    }
  });

  const compPrep = await prisma.course.create({
    data: {
      title: "Competition Prep: Behavioral Science",
      description: "Time-bound prep for external benchmarks.",
      format: CourseFormat.COMPETITION_PREP,
      interestArea: "Psychology",
      isVirtual: true,
      chapterId: frisch.id,
      leadInstructorId: instructor.id
    }
  });

  const pathway = await prisma.pathway.create({
    data: {
      name: "Psychology Pathway",
      description: "From exploration to advanced mentored practice.",
      interestArea: "Psychology",
      steps: {
        create: [
          { courseId: oneOff.id, stepOrder: 1 },
          { courseId: course101.id, stepOrder: 2 },
          { courseId: course201.id, stepOrder: 3 },
          { courseId: course301.id, stepOrder: 4 },
          { courseId: lab.id, stepOrder: 5 },
          { courseId: commons.id, stepOrder: 6 }
        ]
      }
    }
  });

  const module1 = await prisma.trainingModule.create({
    data: {
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
    },
  });

  await prisma.trainingCheckpoint.createMany({
    data: [
      {
        moduleId: module1.id,
        title: "Complete live workshop attendance",
        description: "Attend the full session and review facilitator notes.",
        sortOrder: 1,
        required: true,
      },
      {
        moduleId: module1.id,
        title: "Submit engagement reflection",
        description: "Write a short reflection on 2 strategies you will use in class.",
        sortOrder: 2,
        required: true,
      },
    ],
  });

  await prisma.trainingQuizQuestion.createMany({
    data: [
      {
        moduleId: module1.id,
        question: "What is the best first step when student energy drops mid-session?",
        options: ["Check in with a quick interactive reset", "Keep lecturing without pausing", "End class early"],
        correctAnswer: "Check in with a quick interactive reset",
        sortOrder: 1,
      },
      {
        moduleId: module1.id,
        question: "Which approach best supports engagement in YPP classes?",
        options: ["Student voice and active practice", "One-way slides only", "Skipping check-ins"],
        correctAnswer: "Student voice and active practice",
        sortOrder: 2,
      },
    ],
  });

  const module2 = await prisma.trainingModule.create({
    data: {
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
    },
  });

  await prisma.trainingCheckpoint.createMany({
    data: [
      {
        moduleId: module2.id,
        title: "Practice student support scenarios",
        description: "Complete all listed classroom response drills.",
        sortOrder: 1,
        required: true,
      },
      {
        moduleId: module2.id,
        title: "Review pacing rubric",
        description: "Read and acknowledge the pacing standards guide.",
        sortOrder: 2,
        required: true,
      },
    ],
  });

  await prisma.trainingQuizQuestion.createMany({
    data: [
      {
        moduleId: module2.id,
        question: "If one student dominates discussion, what should you do first?",
        options: ["Invite quieter students with structured turns", "Ignore it completely", "Remove discussion entirely"],
        correctAnswer: "Invite quieter students with structured turns",
        sortOrder: 1,
      },
      {
        moduleId: module2.id,
        question: "What pacing habit helps prevent student confusion?",
        options: ["Set a clear objective and recap transitions", "Rush through all activities", "Skip instructions"],
        correctAnswer: "Set a clear objective and recap transitions",
        sortOrder: 2,
      },
    ],
  });

  const module3 = await prisma.trainingModule.create({
    data: {
      title: "Curriculum Review Capstone",
      description: "Align lesson plans with YPP standards and submit a capstone artifact.",
      type: TrainingModuleType.CURRICULUM_REVIEW,
      required: true,
      sortOrder: 3,
      requiresQuiz: false,
      requiresEvidence: true,
      passScorePct: 80,
    },
  });

  await prisma.trainingCheckpoint.createMany({
    data: [
      {
        moduleId: module3.id,
        title: "Draft a standards-aligned class outline",
        description: "Prepare one full lesson outline aligned to YPP outcomes.",
        sortOrder: 1,
        required: true,
      },
      {
        moduleId: module3.id,
        title: "Complete capstone self-review",
        description: "Run your outline through the quality rubric before submission.",
        sortOrder: 2,
        required: true,
      },
    ],
  });

  const allModules = [module1, module2, module3];

  await prisma.trainingAssignment.createMany({
    data: allModules.map((module, index) => ({
      userId: instructor.id,
      moduleId: module.id,
      status: index === 0 ? TrainingStatus.IN_PROGRESS : TrainingStatus.NOT_STARTED
    }))
  });

  const approval = await prisma.instructorApproval.create({
    data: {
      instructorId: instructor.id,
      status: ApprovalStatus.TRAINING_IN_PROGRESS,
      notes: "Interview completed; training in progress."
    }
  });

  await prisma.instructorApprovalLevel.createMany({
    data: [
      { approvalId: approval.id, level: CourseLevel.LEVEL_101 },
      { approvalId: approval.id, level: CourseLevel.LEVEL_201 }
    ]
  });

  await prisma.mentorship.create({
    data: {
      mentorId: mentor.id,
      menteeId: instructor.id,
      type: MentorshipType.INSTRUCTOR,
      notes: "Monthly growth check-ins and curriculum review support."
    }
  });

  await prisma.event.create({
    data: {
      title: "YPP Showcase Night",
      description: "Festival showcasing student projects from labs.",
      eventType: EventType.FESTIVAL,
      startDate: new Date("2026-03-20T18:00:00Z"),
      endDate: new Date("2026-03-20T20:30:00Z"),
      chapterId: frisch.id
    }
  });

  await prisma.feedback.create({
    data: {
      source: FeedbackSource.PARENT,
      rating: 5,
      comments: "Clear pathway and strong instructor support.",
      courseId: course101.id,
      instructorId: instructor.id,
      chapterId: frisch.id,
      authorId: student.id
    }
  });

  await prisma.enrollment.create({
    data: {
      userId: student.id,
      courseId: course101.id,
      status: "ENROLLED"
    }
  });

  const passionSeeds = [
    {
      name: "Coding",
      category: PassionCategory.STEM,
      description: "Software, apps, game design, and computational thinking.",
      icon: "💻",
      color: "#2563eb",
      order: 1,
    },
    {
      name: "Music",
      category: PassionCategory.MUSIC,
      description: "Performance, songwriting, production, and composition.",
      icon: "🎵",
      color: "#16a34a",
      order: 2,
    },
    {
      name: "Writing",
      category: PassionCategory.WRITING,
      description: "Storytelling, journalism, poetry, and authoring.",
      icon: "✍️",
      color: "#d97706",
      order: 3,
    },
    {
      name: "Design",
      category: PassionCategory.ARTS,
      description: "Visual design, product design, and creative communication.",
      icon: "🎨",
      color: "#db2777",
      order: 4,
    },
  ];

  for (const passion of passionSeeds) {
    await prisma.passionArea.upsert({
      where: { name: passion.name },
      update: {
        category: passion.category,
        description: passion.description,
        icon: passion.icon,
        color: passion.color,
        order: passion.order,
        isActive: true,
      },
      create: {
        ...passion,
        relatedAreaIds: [],
        isActive: true,
      },
    });
  }

  const passionRecords = await prisma.passionArea.findMany({
    where: { name: { in: passionSeeds.map((passion) => passion.name) } },
    select: { id: true, name: true },
  });
  const passionByName = new Map(passionRecords.map((passion) => [passion.name, passion.id]));

  for (const passion of passionRecords.slice(0, 2)) {
    await prisma.studentInterest.upsert({
      where: {
        studentId_passionId: {
          studentId: student.id,
          passionId: passion.id,
        },
      },
      update: {
        isPrimary: passion.name === "Coding",
      },
      create: {
        studentId: student.id,
        passionId: passion.id,
        isPrimary: passion.name === "Coding",
      },
    });
  }

  const tryItSeeds = [
    {
      title: "Build Your First Mini App",
      description: "A 15-minute intro to app thinking and quick prototyping.",
      passionName: "Coding",
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      duration: 15,
      presenter: "Avery Lin",
      order: 1,
    },
    {
      title: "Write a Hook in 20 Minutes",
      description: "A quick songwriting sprint with an easy verse-chorus structure.",
      passionName: "Music",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      duration: 20,
      presenter: "Carly Gelles",
      order: 2,
    },
  ];

  for (const seed of tryItSeeds) {
    const passionId = passionByName.get(seed.passionName);
    if (!passionId) continue;

    const existing = await prisma.tryItSession.findFirst({
      where: {
        title: seed.title,
        passionId,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.tryItSession.create({
        data: {
          passionId,
          title: seed.title,
          description: seed.description,
          videoUrl: seed.videoUrl,
          duration: seed.duration,
          presenter: seed.presenter,
          isActive: true,
          order: seed.order,
        },
      });
    }
  }

  const talentSeeds = [
    {
      title: "One-Scene Story Sprint",
      description: "Write and revise one high-impact scene in under 30 minutes.",
      instructions: "Draft a scene with conflict, then revise for clarity and pacing.",
      passionNames: ["Writing"],
      difficulty: "MEDIUM",
      estimatedMinutes: 30,
      order: 1,
    },
    {
      title: "Rapid Poster Design Challenge",
      description: "Create a poster for a chapter event using a clear visual hierarchy.",
      instructions: "Use one headline, one image, and one call-to-action. Keep it readable.",
      passionNames: ["Design"],
      difficulty: "EASY",
      estimatedMinutes: 25,
      order: 2,
    },
  ];

  for (const seed of talentSeeds) {
    const existing = await prisma.talentChallenge.findFirst({
      where: { title: seed.title },
      select: { id: true },
    });
    if (existing) continue;

    const passionIds = seed.passionNames
      .map((name) => passionByName.get(name))
      .filter((value): value is string => Boolean(value));

    await prisma.talentChallenge.create({
      data: {
        title: seed.title,
        description: seed.description,
        instructions: seed.instructions,
        passionIds,
        difficulty: seed.difficulty,
        estimatedMinutes: seed.estimatedMinutes,
        isActive: true,
        order: seed.order,
      },
    });
  }

  console.log(`Seeded Pathways portal data for ${pathway.name}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
