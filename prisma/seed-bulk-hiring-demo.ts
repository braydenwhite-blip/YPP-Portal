import {
  ChapterPresidentApplicationStatus,
  InstructorApplicationStatus,
  PrismaClient,
  RoleType,
} from "@prisma/client";

import {
  TECHNOLOGY_MANAGER_KIND,
  TECHNOLOGY_MANAGER_POSITION_DESCRIPTION,
  TECHNOLOGY_MANAGER_POSITION_REQUIREMENTS,
  TECHNOLOGY_MANAGER_POSITION_TITLE,
} from "../lib/technology-manager-application";

type SeedCtx = {
  prisma: PrismaClient;
  chapterId: string;
  passwordHash: string;
  verifiedAt: Date;
  reviewerId: string;
  chairId: string;
};

const FIRST_NAMES = [
  "Alex", "Blake", "Casey", "Drew", "Ellis", "Finley", "Gray", "Harper", "Indigo", "Jules",
  "Kai", "Logan", "Morgan", "Nico", "Oakley", "Parker", "Quinn", "Reese", "Skyler", "Taylor",
  "Uma", "Vale", "Winter", "Xander", "Yara", "Zion", "Amari", "Briar", "Cedar", "Dakota",
  "Emerson", "Frankie", "Gianni", "Hadley", "Ira", "Jamie", "Kieran", "Lane", "Marlow", "Noor",
  "Orion", "Phoenix", "Rory", "Sage", "Tatum", "Uri", "Vesper", "Wren", "Yael", "Zara",
  "Avery", "Cameron", "Devon", "Eden", "Felix", "Grace", "Henry", "Isla", "Jordan", "Lila",
];

/** Large unique pool — each demo person gets a distinct last name. */
const LAST_NAMES = [
  "Aberdeen", "Ackerman", "Alvarez", "Andersen", "Ashford", "Bakshi", "Ballard", "Barlow",
  "Beaumont", "Bellamy", "Bishop", "Blackwood", "Blanchard", "Bolton", "Bradshaw", "Brennan",
  "Callahan", "Camacho", "Carpenter", "Castillo", "Chaudhry", "Cho", "Cleveland", "Colombo",
  "Compton", "Cortez", "Cunningham", "Dalton", "Davenport", "Delgado", "Donovan", "Drummond",
  "Dunlap", "Eisenberg", "Ellington", "Estrada", "Fairchild", "Farrell", "Figueroa", "Fitzpatrick",
  "Fleming", "Fontaine", "Gallagher", "Garrison", "Goldberg", "Goodwin", "Granados", "Greenwood",
  "Griffith", "Gutierrez", "Haddad", "Harrington", "Hawkins", "Henderson", "Hitchens", "Holloway",
  "Houghton", "Ingram", "Iverson", "Janssen", "Jefferson", "Johansson", "Kaczmarek", "Kaufman",
  "Kensington", "Kowalski", "Krueger", "Larsen", "Leclair", "Lefevre", "Lindqvist", "Livingston",
  "Lockwood", "MacKenzie", "Maldonado", "Mansfield", "Marquez", "McAllister", "McDowell", "Mercado",
  "Middleton", "Montoya", "Moreau", "Nakamura", "Navarro", "Nielsen", "Okafor", "Okamoto",
  "Oliveira", "Ortega", "Padilla", "Pemberton", "Perez", "Pettigrew", "Pritchard", "Quintero",
  "Radcliffe", "Rasmussen", "Reyes", "Richardson", "Rothschild", "Salazar", "Santiago", "Schwartz",
  "Shepherd", "Sinclair", "Solano", "Sullivan", "Takahashi", "Thatcher", "Thornton", "Torres",
  "Underwood", "Valencia", "Vandenberg", "Vargas", "Vaughn", "Villanueva", "Wainwright", "Whitaker",
  "Winchester", "Yamamoto", "Yates", "Zimmerman", "Zhou", "Abrams", "Barrett", "Cartwright",
];

function slugStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, "-");
}

/** Stable but unique pairing — every index gets its own last name from the pool. */
function demoName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]!;
  const last = LAST_NAMES[index % LAST_NAMES.length]!;
  // If we ever exceed the last-name pool, suffix so names stay unique.
  if (index < LAST_NAMES.length) return `${first} ${last}`;
  return `${first} ${last}${Math.floor(index / LAST_NAMES.length) + 1}`;
}

async function upsertDemoUser(
  ctx: SeedCtx,
  email: string,
  name: string,
  primaryRole: RoleType,
  roles: RoleType[]
) {
  return ctx.prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash: ctx.passwordHash,
      emailVerified: ctx.verifiedAt,
      primaryRole,
      chapterId: ctx.chapterId,
      roles: { create: roles.map((role) => ({ role })) },
    },
    update: {
      name,
      passwordHash: ctx.passwordHash,
      emailVerified: ctx.verifiedAt,
      primaryRole,
      chapterId: ctx.chapterId,
      roles: { deleteMany: {}, create: roles.map((role) => ({ role })) },
    },
  });
}

async function ensureTechnologyManagerPosition(ctx: SeedCtx) {
  const legacy = await ctx.prisma.position.findFirst({
    where: { type: "STAFF", chapterId: null, title: "Social Media Manager" },
    select: { id: true },
  });
  if (legacy) {
    return ctx.prisma.position.update({
      where: { id: legacy.id },
      data: {
        title: TECHNOLOGY_MANAGER_POSITION_TITLE,
        description: TECHNOLOGY_MANAGER_POSITION_DESCRIPTION,
        requirements: TECHNOLOGY_MANAGER_POSITION_REQUIREMENTS,
        isOpen: true,
      },
    });
  }

  const existing = await ctx.prisma.position.findFirst({
    where: { type: "STAFF", chapterId: null, title: TECHNOLOGY_MANAGER_POSITION_TITLE },
  });
  if (existing) return existing;

  return ctx.prisma.position.create({
    data: {
      title: TECHNOLOGY_MANAGER_POSITION_TITLE,
      type: "STAFF",
      description: TECHNOLOGY_MANAGER_POSITION_DESCRIPTION,
      requirements: TECHNOLOGY_MANAGER_POSITION_REQUIREMENTS,
      chapterId: null,
      visibility: "NETWORK_WIDE",
      interviewRequired: true,
      isOpen: true,
    },
  });
}

/** Packed hire waitlist — lots of people waiting to be pulled into interviews. */
const INSTRUCTOR_WAITLIST_STATUSES: InstructorApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFO_REQUESTED",
  "ON_HOLD",
  "WAITLISTED",
];

/** Thin active board — only a few people already pulled off waitlist (interview stage). */
const INSTRUCTOR_BOARD_STATUSES: InstructorApplicationStatus[] = [
  "PRE_APPROVED",
  "INTERVIEW_SCHEDULED",
];

const CP_WAITLIST_STATUSES: ChapterPresidentApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFO",
  "WAITLISTED",
];

const CP_BOARD_STATUSES: ChapterPresidentApplicationStatus[] = [
  "INTERVIEW_NEEDED",
  "INTERVIEW_SCHEDULED",
];

const STAFF_WAITLIST_STATUSES: Array<"SUBMITTED" | "UNDER_REVIEW" | "WAITLISTED"> = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "WAITLISTED",
];

const STAFF_BOARD_STATUSES: Array<"INTERVIEW_SCHEDULED"> = ["INTERVIEW_SCHEDULED"];

/** Extra statuses for coverage elsewhere — not seeded in volume on the board. */
const INSTRUCTOR_STATUSES: InstructorApplicationStatus[] = [
  ...INSTRUCTOR_WAITLIST_STATUSES,
  ...INSTRUCTOR_BOARD_STATUSES,
  "INTERVIEW_COMPLETED",
  "CHAIR_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];

const CP_STATUSES: ChapterPresidentApplicationStatus[] = [
  ...CP_WAITLIST_STATUSES,
  ...CP_BOARD_STATUSES,
  "DECISION_NEEDED",
  "ONBOARDING",
  "DECLINED",
  "REJECTED",
];

const STAFF_STATUSES: Array<
  "SUBMITTED" | "UNDER_REVIEW" | "INTERVIEW_SCHEDULED" | "INTERVIEW_COMPLETED" | "WAITLISTED" | "ACCEPTED" | "REJECTED"
> = [...STAFF_WAITLIST_STATUSES, ...STAFF_BOARD_STATUSES, "INTERVIEW_COMPLETED", "ACCEPTED", "REJECTED"];

function copiesForStatus(_status: string, kind: "waitlist" | "board" | "other"): number {
  if (kind === "waitlist") return 4; // pack the hire queue
  if (kind === "board") return 1; // thin active interviews
  return 0; // skip chair/decided extras from bulk — keep board few
}

function instructorKind(status: InstructorApplicationStatus): "waitlist" | "board" | "other" {
  if ((INSTRUCTOR_WAITLIST_STATUSES as readonly string[]).includes(status)) return "waitlist";
  if ((INSTRUCTOR_BOARD_STATUSES as readonly string[]).includes(status)) return "board";
  return "other";
}

function cpKind(status: ChapterPresidentApplicationStatus): "waitlist" | "board" | "other" {
  if ((CP_WAITLIST_STATUSES as readonly string[]).includes(status)) return "waitlist";
  if ((CP_BOARD_STATUSES as readonly string[]).includes(status)) return "board";
  return "other";
}

function staffKind(status: string): "waitlist" | "board" | "other" {
  if ((STAFF_WAITLIST_STATUSES as readonly string[]).includes(status)) return "waitlist";
  if ((STAFF_BOARD_STATUSES as readonly string[]).includes(status)) return "board";
  return "other";
}

export async function seedBulkHiringDemo(ctx: SeedCtx): Promise<void> {
  let userIndex = 0;
  const waitlistKeys: string[] = [];

  // ── One dedicated demo account per portal role ─────────────────────────────
  const roleUsers: Array<{ email: string; name: string; primary: RoleType; roles: RoleType[] }> = [
    {
      email: "demo.staff.only@youthpassionproject.org",
      name: "Sam Rivera",
      primary: RoleType.STAFF,
      roles: [RoleType.STAFF],
    },
    {
      email: "demo.parent@youthpassionproject.org",
      name: "Priya Shah",
      primary: RoleType.PARENT,
      roles: [RoleType.PARENT],
    },
    {
      email: "demo.applicant.pool@example.com",
      name: "Jordan Kim",
      primary: RoleType.APPLICANT,
      roles: [RoleType.APPLICANT],
    },
    {
      email: "demo.staff.chair@youthpassionproject.org",
      name: "Riley Chen",
      primary: RoleType.STAFF,
      roles: [RoleType.STAFF, RoleType.HIRING_CHAIR],
    },
  ];

  for (const row of roleUsers) {
    await upsertDemoUser(ctx, row.email, row.name, row.primary, row.roles);
  }

  // ── Instructor: pack waitlist, thin board ────────────────────────────────
  let instructorSeq = 0;
  for (const status of INSTRUCTOR_STATUSES) {
    const copies = copiesForStatus(status, instructorKind(status));
    for (let n = 1; n <= copies; n++) {
      instructorSeq += 1;
      const name = demoName(userIndex++);
      const email = `bulk.demo.instructor.${slugStatus(status)}.${n}@example.com`;
      const user = await upsertDemoUser(ctx, email, name, RoleType.APPLICANT, [
        RoleType.APPLICANT,
      ]);

      const existing = await ctx.prisma.instructorApplication.findFirst({
        where: { applicantId: user.id },
        select: { id: true },
      });

      const waitlistedAt = new Date(Date.now() - instructorSeq * 2 * 24 * 60 * 60 * 1000);
      const baseData = {
        status,
        motivation: `${name} wants to teach ${status === "WAITLISTED" ? "computer science" : "creative writing"} at YPP.`,
        teachingExperience: "Peer tutoring and club leadership.",
        availability: "Weekday evenings",
        subjectsOfInterest:
          status === "WAITLISTED"
            ? "Computer Science, Web Development"
            : "English, Creative Writing",
        schoolName: "Demo High School",
        graduationYear: 2026,
        reviewerId: status === "SUBMITTED" ? null : ctx.reviewerId,
        reviewerAssignedAt:
          status === "SUBMITTED" ? null : new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        chairQueuedAt: status === "CHAIR_REVIEW" ? new Date() : null,
        updatedAt: waitlistedAt,
      };

      let applicationId = existing?.id;
      if (existing) {
        await ctx.prisma.instructorApplication.update({
          where: { id: existing.id },
          data: baseData,
        });
      } else {
        const created = await ctx.prisma.instructorApplication.create({
          data: {
            applicantId: user.id,
            ...baseData,
          },
        });
        applicationId = created.id;
      }

      if (applicationId) {
        if (status === "WAITLISTED") {
          await ctx.prisma.instructorApplicationChairDecision.deleteMany({
            where: { applicationId },
          });
          await ctx.prisma.instructorApplicationChairDecision.create({
            data: {
              applicationId,
              chairId: ctx.chairId,
              action: "WAITLIST",
              rationale: "Returned to hire queue after interview.",
              decidedAt: waitlistedAt,
            },
          });
        }
        if (instructorKind(status) === "waitlist") {
          waitlistKeys.push(`instructor:${applicationId}`);
        }
      }
    }
  }

  // ── Chapter president: pack waitlist, thin board ─────────────────────────
  let cpSeq = 0;
  for (const status of CP_STATUSES) {
    const copies = copiesForStatus(status, cpKind(status));
    for (let n = 1; n <= copies; n++) {
      cpSeq += 1;
      const name = demoName(userIndex++);
      const email = `bulk.demo.cp.${slugStatus(status)}.${n}@example.com`;
      const user = await upsertDemoUser(ctx, email, name, RoleType.APPLICANT, [
        RoleType.APPLICANT,
      ]);

      const waitlistedAt = new Date(Date.now() - cpSeq * 3 * 24 * 60 * 60 * 1000);
      const lastName = name.split(" ").slice(1).join(" ") || name;

      await ctx.prisma.chapterPresidentApplication.upsert({
        where: { applicantId: user.id },
        create: {
          applicantId: user.id,
          chapterId: ctx.chapterId,
          status,
          lastName,
          legalName: name,
          preferredFirstName: name.split(" ")[0],
          schoolName: "Demo High School",
          grade: n === 1 ? "11th grade" : "12th grade",
          city: "Scarsdale",
          stateProvince: "New York",
          country: "United States",
          whyChapterPresident: `${name} wants to launch a chapter focused on student-led workshops.`,
          leadershipExperience: "Club president and volunteer organizer.",
          communityServiceExperience: "Weekend tutoring and food drives.",
          chapterVision: "A welcoming chapter that helps students teach what they love.",
          recruitmentPlan: "Start with service clubs and honor societies.",
          launchPlan: "Pilot workshop, then expand to a recurring class.",
          availability: "Weekday evenings",
          hoursPerWeek: 5,
          reviewerId: status === "SUBMITTED" ? null : ctx.reviewerId,
          decisionAt: status === "WAITLISTED" ? waitlistedAt : null,
          decisionMakerId: status === "WAITLISTED" ? ctx.reviewerId : null,
          decisionRecommendation: status === "WAITLISTED" ? ("MAYBE" as const) : null,
          finalDecisionNote:
            status === "WAITLISTED" ? "Waitlisted — strong fit when a chapter slot opens." : null,
          updatedAt: waitlistedAt,
        },
        update: {
          chapterId: ctx.chapterId,
          status,
          lastName,
          reviewerId: status === "SUBMITTED" ? null : ctx.reviewerId,
          decisionAt: status === "WAITLISTED" ? waitlistedAt : null,
          decisionMakerId: status === "WAITLISTED" ? ctx.reviewerId : null,
          decisionRecommendation: status === "WAITLISTED" ? ("MAYBE" as const) : null,
          finalDecisionNote:
            status === "WAITLISTED" ? "Waitlisted — strong fit when a chapter slot opens." : null,
          updatedAt: waitlistedAt,
        },
      });

      const cpApp = await ctx.prisma.chapterPresidentApplication.findUnique({
        where: { applicantId: user.id },
        select: { id: true },
      });
      if (cpApp && cpKind(status) === "waitlist") {
        waitlistKeys.push(`cp:${cpApp.id}`);
      }
    }
  }

  // ── Technology Manager: pack waitlist, thin board ────────────────────────
  const tmPosition = await ensureTechnologyManagerPosition(ctx);
  let staffSeq = 0;
  for (const status of STAFF_STATUSES) {
    const copies = copiesForStatus(status, staffKind(status));
    for (let n = 1; n <= copies; n++) {
      staffSeq += 1;
      const name = demoName(userIndex++);
      const email = `bulk.demo.tech.${slugStatus(status)}.${n}@example.com`;
      const user = await upsertDemoUser(ctx, email, name, RoleType.APPLICANT, [
        RoleType.APPLICANT,
      ]);

      const metadata = JSON.stringify({
        kind: TECHNOLOGY_MANAGER_KIND,
        school: "Demo High School",
        grade: "11",
        platforms: "Portal tools, automations, internal dashboards",
        experience: "Built club websites and helped teachers with Google Workspace.",
        portfolioLinks: "https://example.com/demo-portfolio",
        contentIdeas: "Improve applicant onboarding checklists and admin reporting.",
        weeklyAvailability: "6 hours/week — Tue/Thu evenings",
      });

      const writeStatus = status === "WAITLISTED" ? "SUBMITTED" : status;

      const existing = await ctx.prisma.application.findFirst({
        where: { applicantId: user.id, positionId: tmPosition.id },
        select: { id: true },
      });

      let applicationId = existing?.id;
      if (existing) {
        await ctx.prisma.application.update({
          where: { id: existing.id },
          data: {
            status: writeStatus,
            coverLetter: `${name} is excited to help YPP ship reliable internal tools.`,
            additionalMaterials: metadata,
          },
        });
      } else {
        const created = await ctx.prisma.application.create({
          data: {
            applicantId: user.id,
            positionId: tmPosition.id,
            status: writeStatus,
            coverLetter: `${name} is excited to help YPP ship reliable internal tools.`,
            additionalMaterials: metadata,
          },
        });
        applicationId = created.id;
      }

      if (applicationId) {
        if (status === "WAITLISTED") {
          // Raw SQL — ApplicationStatus.WAITLISTED may not be in a stale Prisma client yet.
          await ctx.prisma.$executeRaw`
            UPDATE "Application"
            SET status = 'WAITLISTED'::"ApplicationStatus", "updatedAt" = NOW()
            WHERE id = ${applicationId}
          `;
        }
        if (staffKind(status) === "waitlist") {
          waitlistKeys.push(`staff:${applicationId}`);
        }
      }
    }
  }

  // Persist hiring waitlist order (everyone still in the hire-queue pool)
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const orderPath = path.join(process.cwd(), "data", "hiring-waitlist-order.json");
  await mkdir(path.dirname(orderPath), { recursive: true });
  await writeFile(
    orderPath,
    `${JSON.stringify({ order: waitlistKeys }, null, 2)}\n`,
    "utf8"
  );

  const instructorCount = INSTRUCTOR_STATUSES.reduce(
    (n, s) => n + copiesForStatus(s, instructorKind(s)),
    0
  );
  const cpCount = CP_STATUSES.reduce((n, s) => n + copiesForStatus(s, cpKind(s)), 0);
  const staffCount = STAFF_STATUSES.reduce((n, s) => n + copiesForStatus(s, staffKind(s)), 0);

  console.log(
    `Bulk hiring demo: ${roleUsers.length} role accounts, ${instructorCount} instructor apps, ${cpCount} CP apps, ${staffCount} tech-manager apps, ${waitlistKeys.length} hire-queue entries.`
  );
}
