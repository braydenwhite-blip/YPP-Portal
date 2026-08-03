/**
 * One-off: create a released (published) MentorGoalReview so the mentee
 * Review tab has something to show. Usage:
 *   node scripts/seed-demo-released-review.mjs [menteeEmailOrName]
 */
require("dotenv").config({ path: ".env.local" });
const { PrismaClient, GoalRatingColor, GoalReviewStatus } = require("@prisma/client");

const prisma = new PrismaClient();
const needle = (process.argv[2] || "").trim().toLowerCase();

async function main() {
  const pairs = await prisma.mentorship.findMany({
    where: { status: "ACTIVE" },
    take: 50,
    select: {
      id: true,
      menteeId: true,
      mentorId: true,
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      mentor: { select: { id: true, name: true, email: true } },
      goalReviews: {
        where: { releasedToMenteeAt: { not: null } },
        select: { id: true },
        take: 3,
      },
    },
    orderBy: { startDate: "desc" },
  });

  console.log(
    "Active mentorships:\n" +
      pairs
        .map(
          (p) =>
            `- ${p.mentee.name || p.mentee.email} (${p.mentee.email}) ← ${p.mentor.name || p.mentor.email} · released=${p.goalReviews.length}`
        )
        .join("\n")
  );

  let target = pairs[0] ?? null;
  if (needle) {
    target =
      pairs.find(
        (p) =>
          p.mentee.email.toLowerCase().includes(needle) ||
          (p.mentee.name || "").toLowerCase().includes(needle)
      ) ?? null;
  } else {
    // Prefer a mentee who still has no released review.
    target = pairs.find((p) => p.goalReviews.length === 0) ?? pairs[0] ?? null;
  }

  if (!target) {
    throw new Error(
      needle
        ? `No active mentorship for "${needle}".`
        : "No active mentorships found."
    );
  }

  const now = new Date();
  const cycleMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const existingMax = await prisma.monthlySelfReflection.aggregate({
    where: { mentorshipId: target.id },
    _max: { cycleNumber: true },
  });
  const cycleNumber = (existingMax._max.cycleNumber ?? 0) + 1;

  const reflection = await prisma.monthlySelfReflection.create({
    data: {
      mentorshipId: target.id,
      menteeId: target.menteeId,
      cycleMonth,
      cycleNumber,
      overallReflection:
        "Demo reflection for testing — felt solid progress this cycle with clearer priorities.",
      engagementOverall: "Engaged and motivated.",
      workingWell: "Clear goals and regular check-ins.",
      supportNeeded: "Keep feedback specific and timely.",
      mentorHelpfulness: "Very helpful and concrete.",
      collaborationAssessment: "Collaboration is strong.",
      teamMembersAboveAndBeyond: "Mentor followed up quickly.",
      collaborationImprovements: "Document decisions after meetings.",
      additionalReflections: "Ready for next month’s focus.",
    },
  });

  const review = await prisma.mentorGoalReview.create({
    data: {
      mentorId: target.mentorId,
      menteeId: target.menteeId,
      mentorshipId: target.id,
      selfReflectionId: reflection.id,
      cycleMonth,
      cycleNumber,
      isQuarterly: cycleNumber % 3 === 0,
      overallRating: GoalRatingColor.ACHIEVED,
      overallComments:
        "Demo published review — strong month. You stayed focused on priorities, collaborated well, and delivered clear evidence of progress. Keep building on what’s working.",
      planOfAction:
        "1) Finish the top open action from this month.\n2) Share one win and one blocker in your next check-in.\n3) Draft next-cycle goals with your mentor by mid-month.",
      status: GoalReviewStatus.APPROVED,
      chairApprovedAt: now,
      releasedToMenteeAt: now,
      pointsAwarded: 50,
    },
  });

  // Best-effort title metadata (ignored if the JSON column path fails).
  try {
    await prisma.mentorGoalReview.update({
      where: { id: review.id },
      data: {
        nextMonthGoalDraftsJson: {
          documentTitle: `${cycleMonth.toLocaleString("en-US", {
            month: "long",
            timeZone: "UTC",
          })} ${cycleMonth.getUTCFullYear()} Performance Review`,
        },
      },
    });
  } catch (err) {
    console.warn("Could not set document title metadata:", err.message);
  }

  console.log(
    `\nCreated released review ${review.id} for ${target.mentee.name || target.mentee.email}`
  );
  console.log(
    `Open as that mentee → Mentorship → Review (or /mentorship/people/${target.menteeId}?section=progress)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
