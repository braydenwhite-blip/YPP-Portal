import "dotenv/config";
import {
  PrismaClient,
  Prisma,
  AdminSubtype,
  CourseFormat,
  CourseLevel,
  RoleType,
  MentorshipType,
  EventType,
  FeedbackSource,
  ApprovalStatus,
  PassionCategory,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { resetQaInstructorOnboardingFixture } from "../lib/qa-instructor-onboarding-fixture";
import { isQaInstructorOnboardingEnabled } from "../lib/qa-instructor-onboarding";

const prisma = new PrismaClient();

const SEED_PATHWAY_NAME = "Psychology Pathway";

async function findOrCreateChapter(input: { name: string; city: string; region: string }) {
  const existing = await prisma.chapter.findFirst({ where: { name: input.name } });
  if (existing) return existing;
  return prisma.chapter.create({ data: input });
}

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error("SEED_PASSWORD environment variable is required. Set it before running seed.");
  }
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const verifiedAt = new Date();

  const scarsdale = await findOrCreateChapter({
    name: "Scarsdale",
    city: "Scarsdale",
    region: "Northeast",
  });

  await prisma.user.upsert({
    where: { email: "milo.wald@youthpassionproject.org" },
    create: {
      name: "Milo Wald",
      email: "milo.wald@youthpassionproject.org",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.CHAPTER_PRESIDENT,
      chapterId: scarsdale.id,
      roles: { create: [{ role: RoleType.CHAPTER_PRESIDENT }] },
    },
    update: {
      name: "Milo Wald",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.CHAPTER_PRESIDENT,
      chapterId: scarsdale.id,
      roles: {
        deleteMany: {},
        create: [{ role: RoleType.CHAPTER_PRESIDENT }],
      },
    },
  });

  const adminSubtypeSeeds = [
    { subtype: AdminSubtype.SUPER_ADMIN, isDefaultOwner: true },
    { subtype: AdminSubtype.HIRING_ADMIN, isDefaultOwner: false },
    { subtype: AdminSubtype.MENTORSHIP_ADMIN, isDefaultOwner: false },
    { subtype: AdminSubtype.INTAKE_ADMIN, isDefaultOwner: false },
    { subtype: AdminSubtype.CONTENT_ADMIN, isDefaultOwner: false },
    { subtype: AdminSubtype.COMMUNICATIONS_ADMIN, isDefaultOwner: false },
  ] as const;

  // Brayden White is the Co-President & Chief People Officer (Leadership). The Leadership is
  // modelled as the ADMIN role carrying the Leadership AdminSubtype.
  const brayden = await prisma.user.upsert({
    where: { email: "brayden.white@youthpassionproject.org" },
    create: {
      name: "Brayden White",
      email: "brayden.white@youthpassionproject.org",
      phone: "(917)-538-6197",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.ADMIN,
      chapterId: scarsdale.id,
      roles: {
        create: [{ role: RoleType.ADMIN }, { role: RoleType.INSTRUCTOR }],
      },
      adminSubtypes: {
        create: [{ subtype: AdminSubtype.LEADERSHIP, isDefaultOwner: true }],
      },
    },
    update: {
      name: "Brayden White",
      phone: "(917)-538-6197",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.ADMIN,
      chapterId: scarsdale.id,
      roles: {
        deleteMany: {},
        create: [{ role: RoleType.ADMIN }, { role: RoleType.INSTRUCTOR }],
      },
    },
  });

  await prisma.userAdminSubtype.upsert({
    where: {
      userId_subtype: {
        userId: brayden.id,
        subtype: AdminSubtype.LEADERSHIP,
      },
    },
    create: {
      userId: brayden.id,
      subtype: AdminSubtype.LEADERSHIP,
      isDefaultOwner: true,
    },
    update: {
      isDefaultOwner: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "anthea.zamir@youthpassionproject.org" },
    create: {
      name: "Anthea Zamir",
      email: "anthea.zamir@youthpassionproject.org",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.ADMIN,
      chapterId: scarsdale.id,
      roles: {
        create: [{ role: RoleType.ADMIN }],
      },
      adminSubtypes: {
        create: [...adminSubtypeSeeds],
      },
    },
    update: {
      name: "Anthea Zamir",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.ADMIN,
      chapterId: scarsdale.id,
      roles: {
        deleteMany: {},
        create: [{ role: RoleType.ADMIN }],
      },
      adminSubtypes: {
        deleteMany: {},
        create: [...adminSubtypeSeeds],
      },
    },
  });

  const mentor = await prisma.user.upsert({
    where: { email: "carly.gelles@youthpassionproject.org" },
    create: {
      name: "Carly Gelles",
      email: "carly.gelles@youthpassionproject.org",
      phone: "(914)-907-1779",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.MENTOR,
      chapterId: scarsdale.id,
      roles: {
        create: [{ role: RoleType.MENTOR }, { role: RoleType.STAFF }],
      },
    },
    update: {
      name: "Carly Gelles",
      phone: "(914)-907-1779",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.MENTOR,
      chapterId: scarsdale.id,
      roles: {
        deleteMany: {},
        create: [{ role: RoleType.MENTOR }, { role: RoleType.STAFF }],
      },
    },
  });

  const instructor = await prisma.user.upsert({
    where: { email: "avery.lin@youthpassionproject.org" },
    create: {
      name: "Avery Lin",
      email: "avery.lin@youthpassionproject.org",
      phone: "(646)-555-0127",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.INSTRUCTOR,
      chapterId: scarsdale.id,
      roles: {
        create: [{ role: RoleType.INSTRUCTOR }],
      },
    },
    update: {
      name: "Avery Lin",
      phone: "(646)-555-0127",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.INSTRUCTOR,
      chapterId: scarsdale.id,
      roles: {
        deleteMany: {},
        create: [{ role: RoleType.INSTRUCTOR }],
      },
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "jordan.patel@youthpassionproject.org" },
    create: {
      name: "Jordan Patel",
      email: "jordan.patel@youthpassionproject.org",
      phone: "(347)-555-3391",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.STUDENT,
      chapterId: scarsdale.id,
      roles: {
        create: [{ role: RoleType.STUDENT }],
      },
    },
    update: {
      name: "Jordan Patel",
      phone: "(347)-555-3391",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.STUDENT,
      chapterId: scarsdale.id,
      roles: {
        deleteMany: {},
        create: [{ role: RoleType.STUDENT }],
      },
    },
  });

  // ── Instructor Applicant Workflow V1 seed ──────────────────────────────────
  await seedInstructorApplicantWorkflow(scarsdale.id, passwordHash, verifiedAt);

  // ── Leadership Action Center seed ──────────────────────────────────────────
  await seedLeadershipActionCenter();

  // ── Action Tracker (People Strategy) seed ──────────────────────────────────
  await seedActionTracker();

  // ── Weekly Meetings — default Teams seed ───────────────────────────────────
  await seedTeams();

  // ── Instructor Assignment System (Phase 1) seed ────────────────────────────
  await seedInstructorAssignmentDemoData({
    chapterId: scarsdale.id,
  });

  // ── Regular Instructor Assignments demo seed ───────────────────────────────
  await seedRegularInstructorAssignments({
    chapterId: scarsdale.id,
    instructorId: instructor.id,
    creatorId: instructor.id,
  });

  if (isQaInstructorOnboardingEnabled()) {
    const qaSummary = await resetQaInstructorOnboardingFixture({
      prismaClient: prisma,
      passwordHash,
      verifiedAt,
    });
    console.log(
      `Seeded QA instructor onboarding fixture for ${qaSummary.instructorEmail}.`
    );
  } else {
    console.log(
      "QA instructor onboarding fixture skipped. Set ENABLE_QA_INSTRUCTOR_ONBOARDING=true to seed it."
    );
  }

  const seedAlreadyPresent = await prisma.pathway.findFirst({
    where: { name: SEED_PATHWAY_NAME },
    select: { id: true },
  });

  if (seedAlreadyPresent) {
    console.log(
      `Seed dataset already present ("${SEED_PATHWAY_NAME}" exists). Updated seed users for the Scarsdale chapter.`
    );
    return;
  }

  const oneOff = await prisma.course.create({
    data: {
      title: "Intro to Forensic Psychology",
      description: "One-off exploration class to spark curiosity.",
      format: CourseFormat.ONE_OFF,
      interestArea: "Psychology",
      chapterId: scarsdale.id,
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
      chapterId: scarsdale.id,
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
      chapterId: scarsdale.id,
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
      chapterId: scarsdale.id,
      leadInstructorId: instructor.id
    }
  });

  const lab = await prisma.course.create({
    data: {
      title: "Passion Lab: Behavioral Research",
      description: "Project-based, in-person-first lab with showcase.",
      format: CourseFormat.LAB,
      interestArea: "Psychology",
      chapterId: scarsdale.id,
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
      chapterId: scarsdale.id,
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
      chapterId: scarsdale.id,
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

  // Legacy WORKSHOP/SCENARIO_PRACTICE seed modules removed: training is now
  // authored exclusively as INTERACTIVE_JOURNEY rows via
  // `lib/training-curriculum/` and imported by `npm run training:import`.

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
      chapterId: scarsdale.id
    }
  });

  await prisma.feedback.create({
    data: {
      source: FeedbackSource.PARENT,
      rating: 5,
      comments: "Clear pathway and strong instructor support.",
      courseId: course101.id,
      instructorId: instructor.id,
      chapterId: scarsdale.id,
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

// ── Instructor Applicant Workflow V1 ──────────────────────────────────────────
async function seedInstructorApplicantWorkflow(
  chapterId: string,
  passwordHash: string,
  verifiedAt: Date
) {
  // HIRING_CHAIR user
  const chair = await prisma.user.upsert({
    where: { email: "hiring.chair@youthpassionproject.org" },
    create: {
      name: "Test 1",
      title: "Hiring Chair",
      email: "hiring.chair@youthpassionproject.org",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.HIRING_CHAIR,
      chapterId,
      roles: { create: [{ role: RoleType.HIRING_CHAIR }] },
    },
    update: {
      name: "Test 1",
      title: "Hiring Chair",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.HIRING_CHAIR,
      chapterId,
      roles: { deleteMany: {}, create: [{ role: RoleType.HIRING_CHAIR }] },
    },
  });

  // Applicant users (idempotent)
  const applicant1 = await prisma.user.upsert({
    where: { email: "demo.applicant.submitted@example.com" },
    create: {
      name: "Test 3",
      title: "Instructor Applicant",
      email: "demo.applicant.submitted@example.com",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.STUDENT,
      chapterId,
      roles: { create: [{ role: RoleType.STUDENT }] },
    },
    update: { name: "Test 3", title: "Instructor Applicant" },
  });

  const applicant2 = await prisma.user.upsert({
    where: { email: "demo.applicant.interview@example.com" },
    create: {
      name: "Test 4",
      title: "Instructor Applicant",
      email: "demo.applicant.interview@example.com",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.STUDENT,
      chapterId,
      roles: { create: [{ role: RoleType.STUDENT }] },
    },
    update: { name: "Test 4", title: "Instructor Applicant" },
  });

  const applicant3 = await prisma.user.upsert({
    where: { email: "demo.applicant.chair@example.com" },
    create: {
      name: "Test 5",
      title: "Instructor Applicant",
      email: "demo.applicant.chair@example.com",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.STUDENT,
      chapterId,
      roles: { create: [{ role: RoleType.STUDENT }] },
    },
    update: { name: "Test 5", title: "Instructor Applicant" },
  });

  // Reviewer user
  const reviewer = await prisma.user.upsert({
    where: { email: "demo.reviewer@youthpassionproject.org" },
    create: {
      name: "Test 2",
      title: "Application Reviewer",
      email: "demo.reviewer@youthpassionproject.org",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.ADMIN,
      chapterId,
      roles: { create: [{ role: RoleType.ADMIN }] },
    },
    update: { name: "Test 2", title: "Application Reviewer" },
  });

  const cpMentor = await prisma.user.upsert({
    where: { email: "demo.cp.mentor@youthpassionproject.org" },
    create: {
      name: "Maya Ortiz",
      title: "Chapter Advisor",
      email: "demo.cp.mentor@youthpassionproject.org",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.MENTOR,
      chapterId,
      roles: { create: [{ role: RoleType.MENTOR }] },
    },
    update: {
      name: "Maya Ortiz",
      title: "Chapter Advisor",
      passwordHash,
      emailVerified: verifiedAt,
      primaryRole: RoleType.MENTOR,
      chapterId,
      roles: { deleteMany: {}, create: [{ role: RoleType.MENTOR }] },
    },
  });

  const cpApplicants = [
    {
      email: "demo.cp.submitted@example.com",
      name: "Avery Shah",
      status: "SUBMITTED",
      schoolName: "Riverbend High School",
      grade: "10th grade",
      city: "Austin",
      stateProvince: "Texas",
      whyChapterPresident: "I want to make YPP feel reachable for students who have never seen themselves as teachers or founders.",
      leadershipExperience: "I organize our debate team novice program and coordinate weekly practice groups.",
      communityServiceExperience: "I volunteer at the public library's homework help table for middle school students.",
      potentialChapterLocation: "Riverbend High School library",
      firstThreeActions: "1. Meet with a faculty sponsor.\n2. Invite a founding team.\n3. Run an interest survey.",
      chapterVision: "A small but consistent chapter that helps students turn hobbies into short classes.",
      recruitmentPlan: "Start with debate, robotics, and art club leaders, then ask each founding member to invite two friends.",
      launchPlan: "Hold a planning meeting in September, train founding members in October, and launch the first class in November.",
    },
    {
      email: "demo.cp.needs-interview@example.com",
      name: "Mina Park",
      status: "INTERVIEW_NEEDED",
      schoolName: "Northview Academy",
      grade: "11th grade",
      city: "Edison",
      stateProvince: "New Jersey",
      whyChapterPresident: "Our school has many students who tutor informally. I want to turn that energy into a real chapter.",
      leadershipExperience: "Student council service chair and founder of a peer math circle.",
      communityServiceExperience: "Led supply drives and ran weekend tutoring at a community center.",
      potentialChapterLocation: "Northview Academy community room",
      firstThreeActions: "1. Confirm school approval.\n2. Recruit three founding instructors.\n3. Pick a first workshop topic.",
      chapterVision: "A chapter that runs practical one-day workshops before expanding to recurring programs.",
      recruitmentPlan: "Invite service clubs and honor society members to become founding instructors.",
      launchPlan: "Run a public speaking pilot workshop within six weeks of approval.",
      reviewerNotes: "Strong local opportunity and concrete launch path. Interview should test reliability and support needs.",
      scoreLeadership: 4,
      scoreVision: 4,
      scoreOrganization: 3,
      scoreCommitment: 4,
      scoreFit: 4,
      scoreCommunication: 3,
      scoreRecruiting: 4,
      scoreOverallConfidence: 4,
    },
    {
      email: "demo.cp.interview-scheduled@example.com",
      name: "Leo Martinez",
      status: "INTERVIEW_SCHEDULED",
      schoolName: "Cedar Grove High",
      grade: "12th grade",
      city: "Phoenix",
      stateProvince: "Arizona",
      whyChapterPresident: "I want to connect students who love creative technology with younger kids who need mentors.",
      leadershipExperience: "Robotics outreach captain and summer camp counselor.",
      communityServiceExperience: "Built beginner coding lessons for a neighborhood youth center.",
      potentialChapterLocation: "Cedar Grove High media lab",
      firstThreeActions: "1. Meet with media lab teacher.\n2. Recruit robotics outreach members.\n3. Draft a beginner coding workshop.",
      chapterVision: "A chapter focused on creative tech, design, and coding workshops.",
      recruitmentPlan: "Start with robotics and art students, then recruit through morning announcements.",
      launchPlan: "Host a planning call, run one pilot workshop, and gather feedback before expanding.",
      interviewScheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      interviewMeetingUrl: "https://meet.example.com/cp-leo",
      reviewerNotes: "Interview scheduled to check launch timeline and founding team plan.",
    },
    {
      email: "demo.cp.decision-needed@example.com",
      name: "Sofia Nguyen",
      status: "DECISION_NEEDED",
      schoolName: "Lakewood STEM",
      grade: "11th grade",
      city: "Seattle",
      stateProvince: "Washington",
      whyChapterPresident: "I want students at my school to lead service projects that use what they already love learning.",
      leadershipExperience: "Founder of a science fair support group and captain of varsity tennis.",
      communityServiceExperience: "Organized STEM demo days for elementary students.",
      potentialChapterLocation: "Lakewood STEM cafeteria",
      firstThreeActions: "1. Confirm advisor.\n2. Build a founding team.\n3. Schedule a first chapter planning call.",
      chapterVision: "A chapter that starts with accessible STEM demos and grows into student-led mini-courses.",
      recruitmentPlan: "Recruit from science fair, NHS, and tennis teammates who already volunteer.",
      launchPlan: "Launch a Saturday demo day first, then convert the best demos into a four-week class.",
      reviewerNotes: "High confidence after interview. Needs final leadership decision.",
      interviewNotes: "Clear communicator. Could name concrete founding members and handled volunteer reliability questions well.",
      interviewSummary: "Strong interview with clear local plan.",
      interviewScore: 4,
      interviewConcerns: "May need help pacing the first launch month.",
      recommendationRationale: "Mission fit and launch plan are both strong.",
      decisionRecommendation: "YES",
    },
    {
      email: "demo.cp.onboarding@example.com",
      name: "Noah Williams",
      status: "ONBOARDING",
      schoolName: "South County Prep",
      grade: "12th grade",
      city: "Atlanta",
      stateProvince: "Georgia",
      whyChapterPresident: "I want to keep service learning active after our tutoring club lost its sponsor.",
      leadershipExperience: "Tutoring club president and youth basketball assistant coach.",
      communityServiceExperience: "Mentored middle school students through a church tutoring program.",
      potentialChapterLocation: "South County Prep student center",
      firstThreeActions: "1. Meet new sponsor.\n2. Invite two tutoring club leaders.\n3. Choose orientation date.",
      chapterVision: "A chapter that begins with tutoring and expands into student-designed classes.",
      recruitmentPlan: "Recruit from tutoring club alumni and service club members.",
      launchPlan: "Start with orientation, then a first chapter planning call, then pilot a study-skills workshop.",
      reviewerNotes: "Accepted. Needs profile linkage and launch actions.",
      finalDecisionNote: "Accepted because the applicant has an existing service base and a realistic first month.",
      decisionRecommendation: "YES",
      approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      decisionAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      decisionMakerId: reviewer.id,
      acceptanceEmailSentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      onboardingStartedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      mentorAdvisorId: cpMentor.id,
    },
  ] as const;

  for (const seed of cpApplicants) {
    const { email, name, ...applicationSeed } = seed;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        name,
        title: "Chapter President Applicant",
        email,
        passwordHash,
        emailVerified: verifiedAt,
        primaryRole: RoleType.APPLICANT,
        chapterId,
        roles: { create: [{ role: RoleType.APPLICANT }] },
      },
      update: {
        name,
        title: "Chapter President Applicant",
        passwordHash,
        emailVerified: verifiedAt,
        primaryRole: RoleType.APPLICANT,
        chapterId,
        roles: { deleteMany: {}, create: [{ role: RoleType.APPLICANT }] },
      },
    });

    await prisma.chapterPresidentApplication.upsert({
      where: { applicantId: user.id },
      create: {
        applicantId: user.id,
        chapterId,
        lastName: name.split(" ").slice(1).join(" ") || name,
        reviewerId: seed.status === "SUBMITTED" ? null : reviewer.id,
        availability: "Weekday evenings and Sunday afternoons",
        country: "United States",
        graduationYear: seed.grade === "12th grade" ? 2026 : seed.grade === "11th grade" ? 2027 : 2028,
        hoursPerWeek: 6,
        ...applicationSeed,
      },
      update: {
        chapterId,
        lastName: name.split(" ").slice(1).join(" ") || name,
        reviewerId: seed.status === "SUBMITTED" ? null : reviewer.id,
        availability: "Weekday evenings and Sunday afternoons",
        country: "United States",
        graduationYear: seed.grade === "12th grade" ? 2026 : seed.grade === "11th grade" ? 2027 : 2028,
        hoursPerWeek: 6,
        ...applicationSeed,
      },
    });
  }

  // Application 1 — SUBMITTED
  const existing1 = await prisma.instructorApplication.findFirst({
    where: { applicantId: applicant1.id },
    select: { id: true },
  });
  existing1 ?? await prisma.instructorApplication.create({
    data: {
      applicantId: applicant1.id,
      status: "SUBMITTED",
      motivation: "I have a passion for sharing knowledge about mathematics and want to help students discover the joy of problem-solving.",
      teachingExperience: "3 years tutoring high school students in algebra and calculus.",
      availability: "Weekends and weekday evenings",
      subjectsOfInterest: "Mathematics, Statistics",
      schoolName: "State University",
      graduationYear: 2025,
      timeline: {
        create: [
          {
            kind: "STATUS_CHANGE",
            actorId: applicant1.id,
            payload: { from: null, to: "SUBMITTED" },
          },
        ],
      },
    },
  });

  // Application 2 — INTERVIEW_SCHEDULED (partial materials — no course outline yet)
  const existing2 = await prisma.instructorApplication.findFirst({
    where: { applicantId: applicant2.id },
    select: { id: true },
  });
  existing2 ?? await prisma.instructorApplication.create({
    data: {
      applicantId: applicant2.id,
      status: "INTERVIEW_SCHEDULED",
      motivation: "Teaching is my calling. I want to bring real-world chemistry knowledge to the classroom.",
      teachingExperience: "TA for Organic Chemistry lab for 2 semesters.",
      availability: "Tuesday and Thursday evenings",
      subjectsOfInterest: "Chemistry, Biology",
      schoolName: "Tech Institute",
      graduationYear: 2024,
      reviewerId: reviewer.id,
      reviewerAssignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      documents: {
        create: [
          {
            kind: "FIRST_CLASS_PLAN",
            fileUrl: "https://example.com/demo-first-class-plan.pdf",
            originalName: "first_class_plan.pdf",
            fileSize: 24000,
            uploadedById: applicant2.id,
          },
        ],
      },
      offeredSlots: {
        create: [
          {
            scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            durationMinutes: 45,
            confirmedAt: new Date(),
            offeredByUserId: reviewer.id,
          },
        ],
      },
      timeline: {
        create: [
          { kind: "STATUS_CHANGE", actorId: applicant2.id, payload: { from: null, to: "SUBMITTED" } },
          { kind: "STATUS_CHANGE", actorId: reviewer.id, payload: { from: "SUBMITTED", to: "UNDER_REVIEW" } },
          { kind: "STATUS_CHANGE", actorId: reviewer.id, payload: { from: "UNDER_REVIEW", to: "PRE_APPROVED" } },
          { kind: "STATUS_CHANGE", actorId: reviewer.id, payload: { from: "PRE_APPROVED", to: "INTERVIEW_SCHEDULED" } },
        ],
      },
    },
  });

  // Application 3 — CHAIR_REVIEW (full materials + interview reviews)
  const existing3 = await prisma.instructorApplication.findFirst({
    where: { applicantId: applicant3.id },
    select: { id: true },
  });
  if (!existing3) {
    const app3 = await prisma.instructorApplication.create({
      data: {
        applicantId: applicant3.id,
        status: "CHAIR_REVIEW",
        motivation: "I want to inspire students with the power of computer science and help bridge the opportunity gap.",
        teachingExperience: "Ran a coding bootcamp for underserved youth for 1 year.",
        availability: "Flexible — available most days after 3pm",
        subjectsOfInterest: "Computer Science, Programming",
        schoolName: "Engineering College",
        graduationYear: 2023,
        reviewerId: reviewer.id,
        reviewerAssignedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        materialsReadyAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        chairQueuedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        documents: {
          create: [
            {
              kind: "COURSE_OUTLINE",
              fileUrl: "https://example.com/demo-course-outline.pdf",
              originalName: "course_outline.pdf",
              fileSize: 48000,
              uploadedById: applicant3.id,
            },
            {
              kind: "FIRST_CLASS_PLAN",
              fileUrl: "https://example.com/demo-first-class-plan-cs.pdf",
              originalName: "first_class_plan.pdf",
              fileSize: 31000,
              uploadedById: applicant3.id,
            },
          ],
        },
        timeline: {
          create: [
            { kind: "STATUS_CHANGE", actorId: applicant3.id, payload: { from: null, to: "SUBMITTED" } },
            { kind: "STATUS_CHANGE", actorId: reviewer.id, payload: { from: "SUBMITTED", to: "UNDER_REVIEW" } },
            { kind: "STATUS_CHANGE", actorId: reviewer.id, payload: { from: "UNDER_REVIEW", to: "PRE_APPROVED" } },
            { kind: "STATUS_CHANGE", actorId: reviewer.id, payload: { from: "PRE_APPROVED", to: "INTERVIEW_SCHEDULED" } },
            { kind: "STATUS_CHANGE", actorId: reviewer.id, payload: { from: "INTERVIEW_SCHEDULED", to: "INTERVIEW_COMPLETED" } },
            { kind: "STATUS_CHANGE", actorId: chair.id, payload: { from: "INTERVIEW_COMPLETED", to: "CHAIR_REVIEW" } },
          ],
        },
      },
    });

    // Interviewer assignment
    await prisma.instructorApplicationInterviewer.create({
      data: {
        applicationId: app3.id,
        interviewerId: reviewer.id,
        role: "LEAD",
        assignedById: reviewer.id,
      },
    });

    // Interview review
    await prisma.instructorInterviewReview.create({
      data: {
        applicationId: app3.id,
        reviewerId: reviewer.id,
        status: "SUBMITTED",
        overallRating: "ABOVE_AND_BEYOND",
        recommendation: "ACCEPT",
        // NOTE: the `summary` column was dropped in migration
        // 20260514150000_drop_interview_review_summary; the per-category notes
        // below carry the review narrative now.
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        categories: {
          create: [
            { category: "RELATIONSHIP_BUILDING", rating: "ABOVE_AND_BEYOND", notes: "Clear and engaging communicator." },
            { category: "CURRICULUM_STRENGTH", rating: "ABOVE_AND_BEYOND", notes: "Strong curriculum design and clear delivery plan." },
            { category: "COMMUNITY_FIT", rating: "ON_TRACK", notes: "Clearly driven by mission." },
          ],
        },
      },
    });
  }

  console.log("Seeded Instructor Applicant Workflow V1 demo data.");
}

// ── Leadership Action Center demo data ────────────────────────────────────
async function seedLeadershipActionCenter() {
  const existing = await prisma.leadershipActionItem.count();
  if (existing > 0) {
    console.log("Leadership Action Center: existing tasks present, skipping seed.");
    return;
  }

  const brayden = await prisma.user.findUnique({
    where: { email: "brayden.white@youthpassionproject.org" },
    select: { id: true, name: true },
  });
  const anthea = await prisma.user.findUnique({
    where: { email: "anthea.zamir@youthpassionproject.org" },
    select: { id: true, name: true },
  });

  // Use upcoming Monday as the operating week start so the "this week" view
  // immediately shows the demo content regardless of when the seed runs.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const offsetToMonday = (dayOfWeek + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - offsetToMonday);

  function dayOfWeekDate(weekdayIndex: number) {
    // 0 = Mon, 6 = Sun
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + weekdayIndex);
    return d;
  }

  // Meetings ----------------------------------------------------------------
  const officersMeeting = await prisma.leadershipMeeting.create({
    data: {
      title: "Officers weekly sync",
      kind: "OFFICERS",
      scheduledAt: dayOfWeekDate(2), // Wednesday
      ownerId: anthea?.id,
      notes: "Standing officers meeting. Bring decisions, blockers, and items needing officer input.",
    },
  });
  const marketingMeeting = await prisma.leadershipMeeting.create({
    data: {
      title: "Marketing & comms",
      kind: "MARKETING",
      scheduledAt: dayOfWeekDate(3), // Thursday
      ownerId: brayden?.id,
      notes: "Editorial review, social pipeline, newsletter cadence.",
    },
  });
  await prisma.leadershipMeeting.create({
    data: {
      title: "Tech team standup",
      kind: "TECH",
      scheduledAt: dayOfWeekDate(1), // Tuesday
      ownerId: brayden?.id,
      notes: "Portal release planning, bug triage, infra updates.",
    },
  });

  // Action items ------------------------------------------------------------
  const items: Prisma.LeadershipActionItemUncheckedCreateInput[] = [
    {
      title: "Email all summer camps about partnership",
      description: "Send the partnership pitch + scheduling form to the camp directors list.",
      category: "COMMUNICATION",
      status: "IN_PROGRESS",
      priority: "HIGH",
      source: "SPREADSHEET",
      sourceLabel: "Action Items Tracker · Week of " + weekStart.toLocaleDateString(),
      dueDate: dayOfWeekDate(1),
      weekStart,
      primaryOwnerId: brayden?.id,
      ownerNames: brayden?.name ? [] : ["Brayden"],
      inputNeededNames: ["Anthea"],
      notes: "List is in the partnerships tracker; reuse last summer's template.",
      meetingId: marketingMeeting.id,
    },
    {
      title: "Find Scarsdale instructor applications",
      category: "INSTRUCTION",
      status: "NOT_STARTED",
      priority: "HIGH",
      source: "SPREADSHEET",
      dueDate: dayOfWeekDate(2),
      weekStart,
      primaryOwnerId: anthea?.id,
      ownerNames: anthea?.name ? [] : ["Anthea"],
      needsOfficerDiscussion: true,
      officerDiscussionDate: dayOfWeekDate(2),
      notes: "Need to confirm if forms are still on the legacy Google Drive folder.",
      meetingId: officersMeeting.id,
    },
    {
      title: "Test the portal for instructor signup",
      category: "TECHNOLOGY",
      status: "IN_PROGRESS",
      priority: "NORMAL",
      source: "SPREADSHEET",
      dueDate: dayOfWeekDate(3),
      weekStart,
      primaryOwnerId: brayden?.id,
      inputNeededNames: ["Engineering team"],
      notes: "Walk through every step end-to-end; capture any UX rough edges.",
    },
    {
      title: "Create social media templates",
      category: "COMMUNICATION",
      status: "NOT_STARTED",
      priority: "NORMAL",
      source: "EMAIL",
      sourceLabel: "Weekly update — May",
      dueDate: dayOfWeekDate(5),
      weekStart,
      ownerNames: ["Comms team"],
      meetingId: marketingMeeting.id,
    },
    {
      title: "Centralize parent / student / instructor records",
      category: "STAFF_MANAGEMENT",
      status: "BLOCKED",
      priority: "URGENT",
      source: "SPREADSHEET",
      dueDate: dayOfWeekDate(6),
      weekStart,
      primaryOwnerId: anthea?.id,
      inputNeededNames: ["Brayden"],
      needsOfficerDiscussion: true,
      officerDiscussionDate: dayOfWeekDate(2),
      notes: "Blocked on whether to consolidate inside the portal or stay on Airtable.",
      meetingId: officersMeeting.id,
    },
    {
      title: "Finalize interview questions",
      category: "INSTRUCTION",
      status: "IN_PROGRESS",
      priority: "HIGH",
      source: "SPREADSHEET",
      dueDate: dayOfWeekDate(1),
      weekStart,
      ownerNames: ["Hiring chair"],
      inputNeededNames: ["Anthea"],
      meetingId: officersMeeting.id,
    },
    {
      title: "Draft G&R templates",
      category: "COMMUNICATION",
      status: "NOT_STARTED",
      priority: "HIGH",
      source: "SPREADSHEET",
      dueDate: dayOfWeekDate(4),
      weekStart,
      primaryOwnerId: brayden?.id,
      needsOfficerDiscussion: true,
      officerDiscussionDate: dayOfWeekDate(2),
      meetingId: officersMeeting.id,
      notes: "Draft for both the mentor and chapter-president roles.",
    },
    {
      title: "Create newsletter templates",
      category: "COMMUNICATION",
      status: "NOT_STARTED",
      priority: "NORMAL",
      source: "EMAIL",
      dueDate: dayOfWeekDate(5),
      weekStart,
      ownerNames: ["Comms team"],
      meetingId: marketingMeeting.id,
    },
  ];

  for (const data of items) {
    await prisma.leadershipActionItem.create({
      data: {
        ...data,
        createdById: brayden?.id ?? null,
        updatedById: brayden?.id ?? null,
        updates: {
          create: {
            authorId: brayden?.id ?? null,
            kind: "CREATED",
            body: "Imported from the seed dataset",
          },
        },
      },
    });
  }

  console.log("Seeded Leadership Action Center demo tasks + meetings.");
}

// ── Instructor Assignment System (Phase 1) ────────────────────────────────────
// Adds a few WorkshopOpportunity rows + sample InstructorAssignments so the
// admin board has something to render out-of-the-box. Idempotent: re-running
// the seed updates the same rows by deterministic title+partner.
async function seedInstructorAssignmentDemoData(input: {
  chapterId: string;
}) {
  const adminOwner = await prisma.user.findUnique({
    where: { email: "brayden.white@youthpassionproject.org" },
    select: { id: true },
  });
  const instructorAvery = await prisma.user.findUnique({
    where: { email: "avery.lin@youthpassionproject.org" },
    select: { id: true },
  });
  if (!adminOwner || !instructorAvery) {
    console.log("Skipping assignment-system seed (admin/instructor not found).");
    return;
  }

  const opportunitySeeds = [
    {
      title: "Summer of Physics — Lincoln Academy",
      partnerName: "Lincoln Summer Academy",
      type: "SUMMER_CAMP" as const,
      status: "OPEN" as const,
      urgency: "HIGH" as const,
      deliveryMode: "IN_PERSON" as const,
      description:
        "Two-week residential physics camp for rising 7th-9th graders. Need lead + assistant.",
      locationName: "Lincoln Academy Campus",
      locationCity: "Boston",
      locationState: "MA",
      locationCountry: "USA",
      startDate: new Date("2026-07-13T13:00:00.000Z"),
      endDate: new Date("2026-07-24T21:00:00.000Z"),
      fillByDate: new Date("2026-06-15T00:00:00.000Z"),
      slotsNeeded: 2,
      ageGroup: "Grades 7-9",
      topicTags: ["physics", "stem", "summer"],
      chapterId: input.chapterId,
    },
    {
      title: "Code Together — Online Workshop Series",
      partnerName: "YPP Internal",
      type: "ONLINE_WORKSHOP" as const,
      status: "OPEN" as const,
      urgency: "NORMAL" as const,
      deliveryMode: "VIRTUAL" as const,
      description:
        "Six-session evening online workshop teaching Python fundamentals. Need one instructor.",
      locationCountry: "USA",
      startDate: new Date("2026-06-08T00:00:00.000Z"),
      endDate: new Date("2026-07-13T00:00:00.000Z"),
      fillByDate: new Date("2026-05-25T00:00:00.000Z"),
      slotsNeeded: 1,
      ageGroup: "Ages 12-15",
      topicTags: ["coding", "python", "online"],
    },
    {
      title: "Frisch Maker Festival",
      partnerName: "The Frisch School",
      type: "ONE_TIME_WORKSHOP" as const,
      status: "OPEN" as const,
      urgency: "URGENT" as const,
      deliveryMode: "IN_PERSON" as const,
      description:
        "One-day maker festival. Need three instructor leads for hands-on stations.",
      locationName: "The Frisch School",
      locationCity: "New York",
      locationState: "NY",
      locationCountry: "USA",
      startDate: new Date("2026-05-30T14:00:00.000Z"),
      endDate: new Date("2026-05-30T22:00:00.000Z"),
      fillByDate: new Date("2026-05-20T00:00:00.000Z"),
      slotsNeeded: 3,
      ageGroup: "Grades 4-8",
      topicTags: ["maker", "robotics", "engineering"],
      chapterId: input.chapterId,
    },
  ];

  for (const seed of opportunitySeeds) {
    const existing = await prisma.workshopOpportunity.findFirst({
      where: { title: seed.title },
      select: { id: true },
    });
    if (existing) {
      await prisma.workshopOpportunity.update({
        where: { id: existing.id },
        data: { ...seed, ownerId: adminOwner.id, createdById: adminOwner.id },
      });
    } else {
      await prisma.workshopOpportunity.create({
        data: { ...seed, ownerId: adminOwner.id, createdById: adminOwner.id },
      });
    }
  }

  // Sample assignment: put Avery as SUGGESTED on the Frisch festival so the
  // admin board shows partial coverage out of the box.
  const frischFestival = await prisma.workshopOpportunity.findFirst({
    where: { title: "Frisch Maker Festival" },
    select: { id: true },
  });
  if (frischFestival) {
    await prisma.instructorAssignment.upsert({
      where: {
        opportunityId_instructorId: {
          opportunityId: frischFestival.id,
          instructorId: instructorAvery.id,
        },
      },
      create: {
        opportunityId: frischFestival.id,
        instructorId: instructorAvery.id,
        role: "LEAD_INSTRUCTOR",
        status: "PENDING",
        assignedById: adminOwner.id,
        internalNotes: "Reached out via Slack DM 2 days ago — awaiting confirmation.",
      },
      update: {},
    });
  }

  console.log("Seeded Instructor Assignment System Phase 1 demo data.");
}

// ── Regular Instructor Assignments demo seed ────────────────────────────────
// Creates one ClassTemplate + two ClassOfferings + a couple of
// RegularInstructorAssignment rows so /admin/instructor-assignments has
// something to show on a fresh seed. Fully idempotent — skips records that
// already exist.
async function seedRegularInstructorAssignments(args: {
  chapterId: string;
  instructorId: string;
  creatorId: string;
}) {
  const { chapterId, instructorId, creatorId } = args;

  const templateTitle = "Demo: Behavioral Science Foundations";

  const template = await prisma.classTemplate.upsert({
    where: { id: `seed-template-${chapterId}` },
    create: {
      id: `seed-template-${chapterId}`,
      title: templateTitle,
      description:
        "Demo template for /admin/instructor-assignments. Foundational behavioral science class for 7th–9th graders.",
      interestArea: "Psychology",
      targetAgeGroup: "12-14",
      classDurationMin: 60,
      durationWeeks: 6,
      sessionsPerWeek: 1,
      deliveryModes: ["VIRTUAL"],
      isPublished: true,
      createdById: creatorId,
      chapterId,
    },
    update: {},
  });

  const offerings: { id: string; title: string }[] = [];
  const offeringSeeds = [
    {
      id: `seed-offering-${chapterId}-1`,
      title: "Behavioral Science Foundations — Spring Cohort A",
      startDateOffsetDays: 7,
      endDateOffsetDays: 49,
    },
    {
      id: `seed-offering-${chapterId}-2`,
      title: "Behavioral Science Foundations — Spring Cohort B",
      startDateOffsetDays: 14,
      endDateOffsetDays: 56,
    },
  ];

  for (const seed of offeringSeeds) {
    const now = Date.now();
    const offering = await prisma.classOffering.upsert({
      where: { id: seed.id },
      create: {
        id: seed.id,
        templateId: template.id,
        instructorId,
        title: seed.title,
        startDate: new Date(now + seed.startDateOffsetDays * 86_400_000),
        endDate: new Date(now + seed.endDateOffsetDays * 86_400_000),
        meetingDays: ["Tuesday"],
        meetingTime: "16:00-17:00",
        deliveryMode: "VIRTUAL",
        capacity: 18,
        status: "DRAFT",
        chapterId,
      },
      update: {},
    });
    offerings.push({ id: offering.id, title: offering.title });
  }

  // First offering: instructor confirmed (LEAD). Second offering: pending
  // review (LEAD) so admins see both lifecycle states on the dashboard.
  if (offerings[0]) {
    await prisma.regularInstructorAssignment.upsert({
      where: {
        offeringId_instructorId_role: {
          offeringId: offerings[0].id,
          instructorId,
          role: "LEAD",
        },
      },
      create: {
        offeringId: offerings[0].id,
        instructorId,
        role: "LEAD",
        status: "FULLY_CONFIRMED",
        chapterId,
        classTemplateId: template.id,
        offeredAt: new Date(),
        instructorConfirmedAt: new Date(),
        chapterConfirmedAt: new Date(),
        adminNotes: "Demo assignment: fully confirmed lead.",
        instructorNote: "Welcome aboard — class kicks off next week.",
        createdById: creatorId,
        updatedById: creatorId,
      },
      update: {},
    });
  }
  if (offerings[1]) {
    await prisma.regularInstructorAssignment.upsert({
      where: {
        offeringId_instructorId_role: {
          offeringId: offerings[1].id,
          instructorId,
          role: "LEAD",
        },
      },
      create: {
        offeringId: offerings[1].id,
        instructorId,
        role: "LEAD",
        status: "PENDING_REVIEW",
        chapterId,
        classTemplateId: template.id,
        adminNotes: "Demo assignment: pending admin review.",
        createdById: creatorId,
        updatedById: creatorId,
      },
      update: {},
    });
  }

  console.log("Seeded regular instructor assignment demo data.");
}

async function seedActionTracker() {
  const existing = await prisma.actionItem.count();
  if (existing > 0) {
    console.log("Action Tracker: existing action items present, skipping seed.");
    return;
  }

  // Leadership users to attach to the demo items (created earlier in main()).
  const brayden = await prisma.user.findUnique({
    where: { email: "brayden.white@youthpassionproject.org" },
    select: { id: true },
  });
  const anthea = await prisma.user.findUnique({
    where: { email: "anthea.zamir@youthpassionproject.org" },
    select: { id: true },
  });
  const carly = await prisma.user.findUnique({
    where: { email: "carly.gelles@youthpassionproject.org" },
    select: { id: true },
  });

  if (!brayden || !anthea || !carly) {
    console.log("Action Tracker: expected seed users missing, skipping seed.");
    return;
  }

  // The five standing functional teams — the single source of truth for the
  // Action Tracker picker. (Previously the seed created three broader
  // departments — "Instructional Affairs"/"Community & Partnerships"/"Platform &
  // Operations" — and, before that, legacy "Instruction"/"Marketing" rows; the
  // seeded demo items now attach to these standing teams so the picker stays
  // clean. The 20260607120000 migration remaps existing action items and
  // archives any leftover legacy rows.)
  const instruction = await prisma.department.upsert({
    where: { name: "Instruction" },
    create: { name: "Instruction", slug: "instruction", description: "Academics — curriculum, teaching, and classroom operations." },
    update: {},
  });
  const partnerships = await prisma.department.upsert({
    where: { name: "Partnerships" },
    create: { name: "Partnerships", slug: "partnerships", description: "Growth — community building, outreach, and partnerships." },
    update: {},
  });
  await prisma.department.upsert({
    where: { name: "Recruitment & Hiring" },
    create: { name: "Recruitment & Hiring", slug: "recruitment-hiring", description: "Recruitment — sourcing, interviewing, and hiring instructors." },
    update: {},
  });
  await prisma.department.upsert({
    where: { name: "Mentorship" },
    create: { name: "Mentorship", slug: "mentorship", description: "Mentorship — pairing, coaching, and instructor growth support." },
    update: {},
  });
  await prisma.department.upsert({
    where: { name: "Operations" },
    create: { name: "Operations", slug: "operations", description: "Operations — platform, logistics, and internal operations." },
    update: {},
  });
  for (const def of [
    { name: "Chapters", slug: "chapters", description: "Chapter launches, expansion, and local chapter leads." },
    { name: "Tech", slug: "tech", description: "Portal, tooling, automation, and technical delivery." },
    { name: "Communications", slug: "communications", description: "Org-wide messaging, announcements, and comms strategy." },
    { name: "Social Media", slug: "social-media", description: "Social content, campaigns, and channel management." },
    { name: "Fundraising", slug: "fundraising", description: "Donor outreach, sponsorships, and fundraising campaigns." },
    { name: "Officers", slug: "officers", description: "Officer-team work that spans multiple functions." },
    { name: "Board", slug: "board", description: "Board-facing priorities, governance, and approvals." },
  ]) {
    await prisma.department.upsert({
      where: { name: def.name },
      create: def,
      update: {},
    });
  }

  const now = new Date();
  const daysFromNow = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };

  // 1) In-progress instruction item. Brayden is BOTH lead and an executor
  //    (same user, two roles), and Anthea is asked for INPUT.
  //    NB: instructor *onboarding* is intentionally NOT a tracker item — it runs
  //    through the dedicated instructor-journey workflow — so this demo item is
  //    a curriculum-rollout task instead (plan comment #14).
  const curriculumRollout = await prisma.actionItem.create({
    data: {
      title: "Refresh fall curriculum rollout",
      description: "Stand up the fall curriculum rollout: confirm leads, schedule, and materials.",
      goalCategory: "Curriculum",
      departmentId: instruction.id,
      status: "IN_PROGRESS",
      deadlineStart: daysFromNow(-2),
      deadlineEnd: daysFromNow(12),
      visibility: "ALL_LEADERSHIP",
      leadId: brayden.id,
      createdById: brayden.id,
      assignments: {
        create: [
          { userId: brayden.id, role: "LEAD" },
          { userId: brayden.id, role: "EXECUTING" },
          { userId: anthea.id, role: "INPUT" },
        ],
      },
      comments: {
        create: [
          {
            authorId: brayden.id,
            type: "INPUT_REQUESTED",
            body: "Anthea — can you confirm the trainer availability before we lock the schedule?",
          },
        ],
      },
      fileLinks: {
        create: [
          {
            label: "Curriculum rollout run-of-show (draft)",
            url: "https://docs.youthpassionproject.org/curriculum-rollout-fall-draft",
            addedById: brayden.id,
          },
        ],
      },
    },
  });

  // 2) Overdue, flagged marketing item in a second department.
  await prisma.actionItem.create({
    data: {
      title: "Finalize Q3 marketing calendar",
      description: "Lock the Q3 content calendar and hand off to the social team.",
      goalCategory: "Brand & Recruitment",
      departmentId: partnerships.id,
      status: "OVERDUE",
      deadlineStart: daysFromNow(-14),
      deadlineEnd: daysFromNow(-3),
      visibility: "ALL_LEADERSHIP",
      flaggedAt: now,
      leadId: anthea.id,
      createdById: brayden.id,
      assignments: {
        create: [
          { userId: anthea.id, role: "LEAD" },
          { userId: carly.id, role: "EXECUTING" },
        ],
      },
    },
  });

  // 3) Officers-only succession prep item (restricted visibility).
  await prisma.actionItem.create({
    data: {
      title: "Prep succession review materials",
      description: "Assemble the Performance × Potential grid inputs ahead of the officers meeting.",
      goalCategory: "People Strategy",
      departmentId: instruction.id,
      status: "NOT_STARTED",
      deadlineStart: daysFromNow(5),
      deadlineEnd: daysFromNow(20),
      visibility: "OFFICERS_ONLY",
      leadId: brayden.id,
      createdById: brayden.id,
      assignments: {
        create: [
          { userId: brayden.id, role: "LEAD" },
          { userId: anthea.id, role: "EXECUTING" },
          { userId: carly.id, role: "INPUT" },
        ],
      },
    },
  });

  console.log(
    `Action Tracker: seeded 3 action items across 2 departments (incl. one overdue + one officers-only). Anchor item: ${curriculumRollout.id}`
  );
}

async function seedTeams() {
  // Default admin-configurable teams for the Weekly Meetings module. Idempotent
  // via the unique slug — re-running seed leaves existing teams untouched.
  const defaults = [
    { slug: "tech", name: "Tech" },
    { slug: "expansion", name: "Expansion" },
    { slug: "fundraising", name: "Fundraising" },
    { slug: "social-media", name: "Social Media" },
  ];
  for (let i = 0; i < defaults.length; i++) {
    const t = defaults[i];
    await prisma.team.upsert({
      where: { slug: t.slug },
      update: {},
      create: { slug: t.slug, name: t.name, sortOrder: i, status: "ACTIVE" },
    });
  }
  console.log("Teams: ensured " + defaults.length + " default teams (Tech, Expansion, Fundraising, Social Media).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
