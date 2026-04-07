import "dotenv/config";
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

  const verifiedAt = new Date();

  const admin = await prisma.user.create({
    data: {
      name: "Brayden White",
      email: "brayden.white@youthpassionproject.org",
      phone: "(917)-538-6197",
      passwordHash,
      emailVerified: verifiedAt,
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
      emailVerified: verifiedAt,
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
      emailVerified: verifiedAt,
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
      emailVerified: verifiedAt,
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
      title: "From Plan to Practice",
      description: "Short video on turning outlines into teachable sessions. Then complete Lesson Design Studio as your capstone (separate step below).",
      type: TrainingModuleType.WORKSHOP,
      required: true,
      sortOrder: 3,
      videoUrl: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
      videoProvider: VideoProvider.YOUTUBE,
      videoDuration: 600,
      requiresQuiz: true,
      requiresEvidence: false,
      passScorePct: 80,
    },
  });

  await prisma.trainingCheckpoint.createMany({
    data: [
      {
        moduleId: module3.id,
        title: "Note one change you will make to your next session plan",
        description: "After the video, capture one concrete improvement you will apply.",
        sortOrder: 1,
        required: true,
      },
    ],
  });

  await prisma.trainingQuizQuestion.createMany({
    data: [
      {
        moduleId: module3.id,
        question: "After the three modules, where do you build and submit your full class plan?",
        options: [
          "Lesson Design Studio",
          "Only by email to admin",
          "It is optional",
          "Only during live onboarding",
        ],
        correctAnswer: "Lesson Design Studio",
        sortOrder: 1,
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

  // ── Learning Modules ──────────────────────────────────────────
  // Using well-known placeholder YouTube IDs from existing seed data.
  // Replace videoUrl values with real educational content before production.
  const learningModuleSeeds = [
    // Coding — Beginner
    {
      passionName: "Coding",
      title: "What Is Programming?",
      description: "A friendly introduction to programming concepts, why code matters, and how computers understand instructions.",
      duration: 12,
      level: "BEGINNER" as const,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      tags: ["intro", "concepts", "mindset"],
      resources: [] as string[],
      order: 1,
    },
    {
      passionName: "Coding",
      title: "HTML & CSS: Build Your First Page",
      description: "Follow along to create a simple web page from scratch. You'll learn HTML structure and basic CSS styling.",
      duration: 20,
      level: "BEGINNER" as const,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      tags: ["html", "css", "web", "frontend"],
      resources: ["https://developer.mozilla.org/en-US/docs/Web/HTML"] as string[],
      order: 2,
    },
    {
      passionName: "Coding",
      title: "JavaScript Basics: Variables & Functions",
      description: "Learn the building blocks of JavaScript — variables, data types, and writing your first functions.",
      duration: 18,
      level: "INTERMEDIATE" as const,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      tags: ["javascript", "functions", "variables"],
      resources: ["https://javascript.info/first-steps"] as string[],
      order: 3,
    },
    {
      passionName: "Coding",
      title: "React in 15 Minutes",
      description: "A fast-paced overview of React components, props, and state. Perfect if you've already done HTML/JS basics.",
      duration: 15,
      level: "ADVANCED" as const,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      tags: ["react", "components", "frontend", "javascript"],
      resources: ["https://react.dev/learn"] as string[],
      order: 4,
    },
    // Music — Beginner to Intermediate
    {
      passionName: "Music",
      title: "Music Theory 101: Notes & Scales",
      description: "Understand the musical alphabet, major scales, and how notes relate to each other on a keyboard.",
      duration: 14,
      level: "BEGINNER" as const,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      tags: ["theory", "scales", "notes", "piano"],
      resources: [] as string[],
      order: 1,
    },
    {
      passionName: "Music",
      title: "Chords & Progressions",
      description: "Learn how to build chords and why certain chord progressions sound so satisfying.",
      duration: 16,
      level: "INTERMEDIATE" as const,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      tags: ["chords", "theory", "songwriting"],
      resources: [] as string[],
      order: 2,
    },
    {
      passionName: "Music",
      title: "Write a Song in 30 Minutes",
      description: "A creative challenge module — follow along to write a simple verse-chorus song from scratch.",
      duration: 30,
      level: "INTERMEDIATE" as const,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      tags: ["songwriting", "creativity", "challenge"],
      resources: [] as string[],
      order: 3,
    },
    // Writing
    {
      passionName: "Writing",
      title: "The Anatomy of a Great Story",
      description: "Explore the three-act structure, character arcs, and what makes readers keep turning pages.",
      duration: 13,
      level: "BEGINNER" as const,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      tags: ["story", "structure", "fiction"],
      resources: [] as string[],
      order: 1,
    },
    {
      passionName: "Writing",
      title: "Writing Vivid Characters",
      description: "Techniques for creating characters that feel real — backstory, motivation, voice, and contradiction.",
      duration: 17,
      level: "INTERMEDIATE" as const,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      tags: ["characters", "craft", "fiction"],
      resources: [] as string[],
      order: 2,
    },
    {
      passionName: "Writing",
      title: "Editing Your Own Work",
      description: "The hardest part of writing is cutting. Learn a practical editing checklist you can use on any draft.",
      duration: 11,
      level: "ADVANCED" as const,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      tags: ["editing", "revision", "craft"],
      resources: [] as string[],
      order: 3,
    },
    // Design
    {
      passionName: "Design",
      title: "Design Principles: Contrast, Alignment, Repetition",
      description: "A visual crash course in the four core design principles — illustrated with real before/after examples.",
      duration: 15,
      level: "BEGINNER" as const,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      tags: ["principles", "layout", "typography"],
      resources: [] as string[],
      order: 1,
    },
    {
      passionName: "Design",
      title: "Color Theory for Designers",
      description: "How to choose colors that work together — color wheels, harmony types, and emotional associations.",
      duration: 14,
      level: "BEGINNER" as const,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      tags: ["color", "theory", "visual"],
      resources: [] as string[],
      order: 2,
    },
    {
      passionName: "Design",
      title: "Figma Fundamentals",
      description: "Get up and running in Figma — frames, auto-layout, components, and your first mockup.",
      duration: 22,
      level: "INTERMEDIATE" as const,
      videoUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      tags: ["figma", "ui", "tools", "prototyping"],
      resources: ["https://help.figma.com/hc/en-us"] as string[],
      order: 3,
    },
  ];

  for (const seed of learningModuleSeeds) {
    const passionId = passionByName.get(seed.passionName);
    if (!passionId) continue;

    const existing = await prisma.learningModule.findFirst({
      where: { passionId, title: seed.title },
      select: { id: true },
    });

    if (!existing) {
      await prisma.learningModule.create({
        data: {
          passionId,
          title: seed.title,
          description: seed.description,
          duration: seed.duration,
          level: seed.level,
          videoUrl: seed.videoUrl,
          tags: seed.tags,
          resources: seed.resources,
          order: seed.order,
          isActive: true,
        },
      });
    }
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
