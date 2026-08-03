require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("crypto");
const prisma = new PrismaClient();

function cuidLike() {
  return "c" + randomBytes(12).toString("hex");
}

async function main() {
  const needle = (process.argv[2] || "anthea").trim().toLowerCase();
  const mentorship = await prisma.mentorship.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        { mentee: { email: { contains: needle, mode: "insensitive" } } },
        { mentee: { name: { contains: needle, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      menteeId: true,
      mentorId: true,
      mentee: { select: { name: true, email: true } },
      mentor: { select: { name: true, email: true } },
    },
  });
  if (!mentorship) throw new Error(`No active mentorship for ${needle}`);

  const now = new Date();
  const cycleMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const max = await prisma.monthlySelfReflection.aggregate({
    where: { mentorshipId: mentorship.id },
    _max: { cycleNumber: true },
  });
  const cycleNumber = (max._max.cycleNumber ?? 0) + 1;

  const reflectionId = cuidLike();
  const reviewId = cuidLike();

  await prisma.$executeRaw`
    INSERT INTO "MonthlySelfReflection" (
      id, "menteeId", "mentorshipId", "cycleMonth", "cycleNumber",
      "overallReflection", "engagementOverall", "workingWell", "supportNeeded",
      "mentorHelpfulness", "collaborationAssessment",
      "teamMembersAboveAndBeyond", "collaborationImprovements", "additionalReflections",
      "submittedAt"
    ) VALUES (
      ${reflectionId}, ${mentorship.menteeId}, ${mentorship.id}, ${cycleMonth}, ${cycleNumber},
      ${"Demo reflection for testing — solid progress this cycle."},
      ${"Engaged and motivated."},
      ${"Clear goals and regular check-ins."},
      ${"Keep feedback specific and timely."},
      ${"Very helpful and concrete."},
      ${"Collaboration is strong."},
      ${"Mentor followed up quickly."},
      ${"Document decisions after meetings."},
      ${"Ready for next month’s focus."},
      ${now}
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "MentorGoalReview" (
      id, "mentorId", "menteeId", "mentorshipId", "selfReflectionId",
      "cycleMonth", "cycleNumber", "isQuarterly", "overallRating",
      "overallComments", "planOfAction", status,
      "chairApprovedAt", "releasedToMenteeAt", "bonusPoints", "pointsAwarded",
      "aiDraftUsed", "createdAt", "updatedAt"
    ) VALUES (
      ${reviewId}, ${mentorship.mentorId}, ${mentorship.menteeId}, ${mentorship.id}, ${reflectionId},
      ${cycleMonth}, ${cycleNumber}, ${cycleNumber % 3 === 0}, ${"ACHIEVED"}::"GoalRatingColor",
      ${"Demo published review — strong month. You stayed focused on priorities, collaborated well, and delivered clear evidence of progress. Keep building on what’s working."},
      ${"1) Finish the top open action from this month.\n2) Share one win and one blocker in your next check-in.\n3) Draft next-cycle goals with your mentor by mid-month."},
      ${"APPROVED"}::"GoalReviewStatus",
      ${now}, ${now}, 0, 50,
      false, ${now}, ${now}
    )
  `;

  console.log(`Created released review ${reviewId}`);
  console.log(`Mentee: ${mentorship.mentee.name} <${mentorship.mentee.email}>`);
  console.log(`Mentor: ${mentorship.mentor.name}`);
  console.log(`Open Mentorship → Review while logged in as ${mentorship.mentee.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
