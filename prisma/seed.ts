import { PrismaClient, CourseFormat, CourseLevel, TrainingModuleType, RoleType, MentorshipType, EventType, FeedbackSource, TrainingStatus, ApprovalStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ypp-demo-2026", 10);

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

  const modules = await prisma.trainingModule.createMany({
    data: [
      {
        title: "Zoom Workshop: Teaching on YPP",
        description: "Live workshop on facilitation and engagement.",
        type: TrainingModuleType.WORKSHOP,
        required: true,
        sortOrder: 1
      },
      {
        title: "Situation Practice",
        description: "Scenario drills for student support and pacing.",
        type: TrainingModuleType.SCENARIO_PRACTICE,
        required: true,
        sortOrder: 2
      },
      {
        title: "Curriculum Review",
        description: "Align lesson plans with YPP standards.",
        type: TrainingModuleType.CURRICULUM_REVIEW,
        required: true,
        sortOrder: 3
      }
    ]
  });

  const allModules = await prisma.trainingModule.findMany();

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
