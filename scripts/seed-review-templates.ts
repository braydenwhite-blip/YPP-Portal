/**
 * Seeds the Instructor and Global Leadership G&R review templates for the
 * universal performance-development cycle — competency rubric rows (kind:
 * COMPETENCY), rubric columns, and role mission, all with the verbatim
 * content supplied by product/leadership. Idempotent: upserts by
 * (roleType, title) so it's safe to re-run in any environment.
 *
 * Run with: npx tsx scripts/seed-review-templates.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INSTRUCTOR_ROLE_MISSION = `YPP Instructors are responsible for creating engaging, meaningful, and high-quality learning experiences that help students explore and develop their passions. Instructors play a central role in shaping the YPP experience through excellent teaching and family relationships, professionalism, and active contribution to the broader YPP community. Beyond the classroom, instructors are expected to grow as leaders, collaborators, and ambassadors for YPP's mission and culture. Successful instructors will be promoted to greater roles within the organization:

Instructor — Delivers strong classroom experiences, builds positive student relationships, and contributes reliably to the YPP community.
Senior Instructor (promotion after 2-4 strong months as Instructor) — Demonstrates exceptional teaching and mentorship, contributes beyond the classroom through initiatives, events, and leadership, and helps support and develop other instructors.
Lead Instructor (promotion after 2-4 strong months as Senior Instructor) — Provides organization-wide leadership through training, curriculum development, mentorship, program quality oversight, and community-building initiatives.`;

const INSTRUCTOR_COLUMNS = ["Instructor", "Senior Instructor", "Lead Instructor"] as const;

type LevelGuidance = Record<string, string>;

const INSTRUCTOR_COMPETENCIES: Array<{ title: string; description: string; levelGuidance: LevelGuidance }> = [
  {
    title: "Curriculum & Class Delivery",
    description: "Delivering organized, engaging, high-quality classes using an approved curriculum.",
    levelGuidance: {
      Instructor:
        "• Delivers organized, engaging classes using an approved curriculum that captivate students and maintain strong attendance and participation\n" +
        "• Receives positive parent and student feedback regarding class quality and engagement\n" +
        "• Comes prepared and adapts instruction based on student needs and classroom dynamics",
      "Senior Instructor":
        "• Maintains among the strongest student and parent feedback metrics within YPP\n" +
        "• Creates reusable curriculum resources, lesson templates, or enrichment programming\n" +
        "• Coaches or mentors instructors on teaching, engagement, and classroom delivery",
      "Lead Instructor":
        "• Oversees and elevates curriculum and instructional quality across programs\n" +
        "• Leads curriculum improvement, instructor training, and teaching workshops\n" +
        "• Develops scalable teaching standards, systems, and best practices across YPP",
    },
  },
  {
    title: "Student & Family Relationships",
    description: "Building trusting, supportive relationships with students and families.",
    levelGuidance: {
      Instructor:
        "• Builds strong, supportive relationships with students and families through professional and responsive communication\n" +
        "• Advises and encourages students toward continued involvement in YPP opportunities and programs\n" +
        "• Creates an inclusive and welcoming classroom environment where students feel supported and engaged",
      "Senior Instructor":
        "• Builds lasting trust and rapport with students and families across programs\n" +
        "• Serves as a mentor or trusted point of contact for students and families navigating YPP opportunities\n" +
        "• Helps strengthen long-term student engagement and family retention within YPP",
      "Lead Instructor":
        "• Develops relationships with schools, families, and community partners that strengthen YPP's reach and reputation\n" +
        "• Helps guide instructors through difficult student or family situations and communication challenges\n" +
        "• Contributes to systems and strategies that improve family and partner engagement, communication, and retention",
    },
  },
  {
    title: "Organization, Commitment & Reliability",
    description: "Professionalism, responsiveness, and follow-through on responsibilities.",
    levelGuidance: {
      Instructor:
        "• Responds promptly and professionally to communication from staff, students, and families (incl. responding to all messages in 24 hours & attending 100% of meetings)\n" +
        "• Arrives consistently prepared, on time, and ready for classes, meetings, and events\n" +
        "• Completes responsibilities and administrative tasks reliably and on schedule",
      "Senior Instructor":
        "• Demonstrates exceptional reliability, responsiveness, and professionalism across responsibilities\n" +
        "• Handles scheduling, operational issues, or classroom challenges proactively\n" +
        "• Helps improve communication, coordination, and operational efficiency within programs",
      "Lead Instructor":
        "• Models professionalism, accountability, and responsiveness for the broader instructor team\n" +
        "• Helps oversee logistics, scheduling, and instructor coordination/staffing across programs\n" +
        "• Develops or improves systems that strengthen organizational efficiency and execution",
    },
  },
  {
    title: "Leadership, Support Structure & Founder Mentality",
    description: "Ownership, collaboration, and founder mentality within the instructor support structure.",
    levelGuidance: {
      Instructor:
        "• Actively contributes to a positive, collaborative, and supportive YPP culture\n" +
        "• Understands their primary point of contact and communicates professionally through the proper structure\n" +
        "• Takes ownership of their class experience, student engagement, preparation, and follow-through\n" +
        "• Asks for help early when there are class, student, family, scheduling, or curriculum issues\n" +
        "• Demonstrates founder mentality by treating their class as something they are helping build, improve, and represent well\n" +
        "• Participates enthusiastically in trainings, events, meetings, and broader YPP opportunities when asked",
      "Senior Instructor":
        "• Helps strengthen instructor culture through mentorship, collaboration, and community-building\n" +
        "• May serve as a mentor or trusted point of contact for newer instructors, especially during onboarding and early classes\n" +
        "• Helps instructors get started, answer general questions, prepare for classes, and understand YPP expectations\n" +
        "• Helps reduce confusion by guiding instructors to the right person for curriculum, chapter, partner, or operational questions\n" +
        "• Organizes or contributes meaningfully to events, workshops, showcases, one-off programming, or special initiatives\n" +
        "• Demonstrates founder mentality by identifying problems, proposing solutions, and contributing beyond their own class",
      "Lead Instructor":
        "• Provides leadership across curriculum, instructor support, mentorship, program quality, and community-building\n" +
        "• Supports instructors with class-specific or subject-specific planning, teaching improvement, and curriculum development\n" +
        "• Helps clarify roles among mentors, Chapter Presidents, Relationship Leads, and Global Leadership so instructors are not overwhelmed by too many people\n" +
        "• Leads major community-building initiatives, mentorship efforts, instructor engagement programs, or training systems\n" +
        "• Helps shape YPP culture, morale, leadership standards, and organizational clarity\n" +
        "• Demonstrates founder mentality by building scalable systems that make YPP stronger, simpler, and less bureaucratic",
    },
  },
  {
    title: "Long-Term Growth & Increased Involvement",
    description: "Openness to feedback and growth, and expanding involvement within YPP over time.",
    levelGuidance: {
      Instructor:
        "• Demonstrates openness to feedback, growth, and continuous improvement\n" +
        "• Shows willingness to contribute beyond core teaching responsibilities when needed\n" +
        "• Demonstrates interest in expanding involvement and growing within YPP over time",
      "Senior Instructor":
        "• Takes on expanded responsibilities such as event planning, one-off programming, mentoring, or interviewing\n" +
        "• Contributes to curriculum development, onboarding, training, or operational improvements\n" +
        "• Demonstrates initiative and ownership in helping YPP grow and improve",
      "Lead Instructor":
        "• Leads major organizational initiatives such as training, recruiting, curriculum strategy, or mentorship programs\n" +
        "• Helps identify, develop, and support future instructors and leaders within YPP\n" +
        "• Consistently takes on high-impact responsibilities that contribute to YPP's long-term growth and success",
    },
  },
];

const GLOBAL_LEADERSHIP_COLUMNS = [
  "Manager / Senior Manager",
  "Director / Senior Director / Executive Director",
  "Chapter President / Regional Director / Senior Regional Director",
  "Officer",
] as const;

const GLOBAL_LEADERSHIP_ROLE_MISSION =
  "Global Leadership drives YPP's programs, culture, and long-term growth across the organization — delivering measurable impact, proposing and driving new ideas, operating with reliability and clear communication, developing and elevating the people around them, and building the systems and relationships that sustain YPP well beyond any single program cycle.";

const GLOBAL_LEADERSHIP_COMPETENCIES: Array<{ title: string; description: string; levelGuidance: LevelGuidance }> = [
  {
    title: "Impact & Results",
    description: "Delivers high-quality work consistently and reliably.",
    levelGuidance: {
      "Manager / Senior Manager":
        "• Work shows clear, demonstrable impact every week.\n" +
        "• Achieves goals, solves problems, and produces measurable results within area of responsibility.\n" +
        "• Impact extends beyond the specific task to benefit the broader team or program.",
      "Director / Senior Director / Executive Director":
        "Owns outcomes and delivers sustained impact across the entire program, team, or functional area.\n" +
        "• Work shows significant progress and impact every week, beyond individual project level.\n" +
        "• Identifies obstacles, breaks down complex problems into actionable strategies.\n" +
        "• Achieves ambitious goals and lifts the performance of those around them.",
      "Chapter President / Regional Director / Senior Regional Director":
        "Defines and drives organization-wide priorities that produce transformational results every week.\n" +
        "• Ambitious and resourceful — does not let obstacles stand in the way of achieving goals.\n" +
        "• Creates repeatable resources and systems enabling long-term, sustained impact.\n" +
        "• Impact extends beyond any specific project to shape the organization's trajectory.",
      Officer: "",
    },
  },
  {
    title: "Ideas & Initiative",
    description: "Proactively proposes new systems, programs, and improvements.",
    levelGuidance: {
      "Manager / Senior Manager":
        "• Does not simply complete assigned work; proactively proposes new systems, programs, and improvements without being asked.\n" +
        "• Takes ownership of challenges and opportunities within their area of responsibility.\n" +
        "• Brings forward ideas that improve efficiency, quality, or mission alignment.",
      "Director / Senior Director / Executive Director":
        "• Identifies gaps and opportunities at the program or team level and develops concrete initiatives to address them.\n" +
        "• Drives cross-functional improvements; champions ideas that elevate the work of multiple teams.\n" +
        "• Creates space for others' ideas while ensuring the strongest proposals move forward.",
      "Chapter President / Regional Director / Senior Regional Director":
        "• Has a strategic vision; generates new high-impact ideas that drive progress across the organization.\n" +
        "• Translates broad challenges into actionable priorities; takes initiative to implement ideas beyond particular role.\n" +
        "• Removes systemic barriers to good ideas and builds structures that make initiative the norm.",
      Officer: "",
    },
  },
  {
    title: "Timeliness, Reliability & Communication",
    description: "On-time output, responsiveness, and proactive communication.",
    levelGuidance: {
      "Manager / Senior Manager":
        "• Consistently produces on-time output and follows through with minimal oversight or reminders.\n" +
        "• Responds promptly to messages (never more than 24 hours) and attends 100% of meetings.\n" +
        "• Communicates proactively when timelines or expectations shift.",
      "Director / Senior Director / Executive Director":
        "• Ensures both personal work and team deliverables are completed reliably and on time; moves progress forward without day-long delays.\n" +
        "• Establishes systems, expectations, and accountability mechanisms that improve team performance.\n" +
        "• Communicates proactively and effectively with stakeholders and team members; responds within 24 hours and attends 100% of meetings.",
      "Chapter President / Regional Director / Senior Regional Director":
        "• Creates a culture of accountability, reliability, and responsiveness across the organization; moves progress forward on the same day as receiving input rather than delaying.\n" +
        "• Designs scalable processes and structures that enable consistent, high-quality execution.\n" +
        "• Ensures strong communication and alignment across teams and organizational levels; responds within 24 hours and attends 100% of meetings.",
      Officer: "",
    },
  },
  {
    title: "Leadership, Community & Collaboration",
    description: "Leading community-building, mentoring others, and modeling YPP values.",
    levelGuidance: {
      "Manager / Senior Manager":
        "• Leads major community-building initiatives, mentorship efforts, or instructor engagement.\n" +
        "• Helps shape YPP culture, morale, and organizational community standards.\n" +
        "• Motivates and manages team members to fulfill their responsibilities with care and excellence.",
      "Director / Senior Director / Executive Director":
        "• Develops and manages staff to reach their potential; actively mentors junior team members, helps them improve, and creates opportunities for them to take on greater responsibility.\n" +
        "• Fosters collaboration across departments, models YPP values, and holds the team to high standards of conduct.",
      "Chapter President / Regional Director / Senior Regional Director":
        "• Leads others to successful output; successfully manages, develops, and mentors others, creating opportunities for them to take on greater responsibility.\n" +
        "• Contributes positively to the YPP community, boosting collaboration and morale. Collaborates effectively across the entire organization.",
      Officer: "",
    },
  },
  {
    title: "Continuity and Long-Term Potential",
    description: "Building sustainable structures, relationships, and readiness for broader responsibility.",
    levelGuidance: {
      "Manager / Senior Manager":
        "• Leads major organizational initiatives with high impact beyond their specific role.\n" +
        "• Eager to take on more responsibility; genuinely cares about the organization's long-term success.\n" +
        "• Has a vision for YPP and the practical leadership, judgment, and discipline to carry it out.",
      "Director / Senior Director / Executive Director":
        "• Demonstrates readiness for broader responsibility; proactively develops the skills needed for the next level of leadership.\n" +
        "• Mentors and sponsors high-potential junior staff and builds systems that will outlast their current role.\n" +
        "• Cultivates long-term relationships with key external stakeholders — community leaders, parent networks, and partner organizations — that will serve YPP's mission well beyond any single program cycle.",
      "Chapter President / Regional Director / Senior Regional Director":
        "• Actively shapes the long-term strategic direction and sustainability of the organization; eager to take on more responsibility and genuinely cares about success.\n" +
        "Builds sustainable structures and plans for organizational continuity.\n" +
        "• Develops and stewards a broad ecosystem of long-term relationships — with communities, parents, funders, and partners — that YPP can reliably activate for programs, support, and growth.",
      Officer: "",
    },
  },
];

async function resolveSeedOwnerId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: {
      OR: [
        { primaryRole: "ADMIN" },
        { adminSubtypes: { some: { subtype: { in: ["SUPER_ADMIN", "LEADERSHIP"] } } } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw new Error(
      "No admin user found to attribute these templates to — seed users before running this script."
    );
  }
  return admin.id;
}

async function upsertTemplate(args: {
  title: string;
  roleType: "INSTRUCTOR" | "GLOBAL_LEADERSHIP";
  roleMission: string;
  columns: readonly string[];
  competencies: Array<{ title: string; description: string; levelGuidance: LevelGuidance }>;
  ownerId: string;
}): Promise<void> {
  const { title, roleType, roleMission, columns, competencies, ownerId } = args;

  const existing = await prisma.gRTemplate.findFirst({
    where: { roleType, title },
    select: { id: true },
  });

  const templateId = existing
    ? (
        await prisma.gRTemplate.update({
          where: { id: existing.id },
          data: { roleMission, columns: columns as unknown as object, isActive: true },
          select: { id: true },
        })
      ).id
    : (
        await prisma.gRTemplate.create({
          data: {
            title,
            roleType,
            roleMission,
            columns: columns as unknown as object,
            createdById: ownerId,
            lastEditedById: ownerId,
          },
          select: { id: true },
        })
      ).id;

  for (let i = 0; i < competencies.length; i++) {
    const c = competencies[i];
    const existingGoal = await prisma.gRTemplateGoal.findFirst({
      where: { templateId, title: c.title, kind: "COMPETENCY" },
      select: { id: true },
    });
    const data = {
      title: c.title,
      description: c.description,
      timePhase: "LONG_TERM" as const,
      sortOrder: i,
      kind: "COMPETENCY" as const,
      levelGuidance: c.levelGuidance as unknown as object,
    };
    if (existingGoal) {
      await prisma.gRTemplateGoal.update({ where: { id: existingGoal.id }, data });
    } else {
      await prisma.gRTemplateGoal.create({ data: { ...data, templateId } });
    }
  }

  console.log(`Seeded template "${title}" (${roleType}) with ${competencies.length} competencies.`);
}

async function main() {
  const ownerId = await resolveSeedOwnerId();

  await upsertTemplate({
    title: "Instructor Performance & Growth",
    roleType: "INSTRUCTOR",
    roleMission: INSTRUCTOR_ROLE_MISSION,
    columns: INSTRUCTOR_COLUMNS,
    competencies: INSTRUCTOR_COMPETENCIES,
    ownerId,
  });

  await upsertTemplate({
    title: "Global Leadership Performance & Growth",
    roleType: "GLOBAL_LEADERSHIP",
    roleMission: GLOBAL_LEADERSHIP_ROLE_MISSION,
    columns: GLOBAL_LEADERSHIP_COLUMNS,
    competencies: GLOBAL_LEADERSHIP_COMPETENCIES,
    ownerId,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
