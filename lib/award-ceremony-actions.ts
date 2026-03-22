"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";
import { CERTIFICATE_TIER_CONFIG, generateCertificateSvg } from "@/lib/certificate-utils";

// Private alias for internal use
const TIER_CONFIG = CERTIFICATE_TIER_CONFIG;

// ============================================
// FETCH: CERTIFICATE DATA
// ============================================

/**
 * Get or generate a certificate for the current user's current tier.
 */
export async function getMyCertificate() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  const [user, summary] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        chapter: { select: { name: true } },
        menteePairs: {
          where: { status: "ACTIVE" },
          select: { mentor: { select: { name: true } } },
          take: 1,
        },
      },
    }),
    prisma.achievementPointSummary.findUnique({
      where: { userId },
      select: { totalPoints: true, currentTier: true },
    }),
  ]);

  if (!user || !summary?.currentTier) return null;

  const tier = summary.currentTier;
  const cfg = TIER_CONFIG[tier];

  return {
    recipientName: user.name,
    tier,
    tierLabel: cfg?.label ?? tier,
    tierEmoji: cfg?.emoji ?? "",
    tierDescription: cfg?.description ?? "",
    totalPoints: summary.totalPoints,
    volunteerHours: cfg?.volunteerHours ?? 0,
    mentorName: user.menteePairs[0]?.mentor?.name ?? null,
    chapterName: user.chapter?.name ?? null,
  };
}

/**
 * Generate and store a certificate for a user (admin/chair action on tier award).
 */
export async function issueCertificate(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");

  const targetUserId = String(formData.get("userId") ?? "").trim();
  const tier = String(formData.get("tier") ?? "").trim();
  const nominationId = String(formData.get("nominationId") ?? "").trim();

  if (!targetUserId || !tier || !nominationId) throw new Error("Missing required fields");

  // Check for existing certificate for this nomination
  const existing = await prisma.awardCertificate.findUnique({ where: { nominationId } });
  if (existing) return { success: true, certificateId: existing.id };

  const [user, mentorship] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: {
        name: true,
        chapter: { select: { name: true } },
        menteePairs: {
          where: { status: "ACTIVE" },
          select: { mentor: { select: { name: true } } },
          take: 1,
        },
      },
    }),
    prisma.mentorship.findFirst({
      where: { menteeId: targetUserId, status: "ACTIVE" },
      select: { mentor: { select: { name: true } } },
    }),
  ]);

  const issuedAt = new Date().toISOString();
  const svgData = generateCertificateSvg({
    recipientName: user.name,
    tier,
    issuedDate: issuedAt,
    mentorName: mentorship?.mentor?.name ?? user.menteePairs[0]?.mentor?.name ?? null,
    chapterName: user.chapter?.name ?? null,
  });

  const certificate = await prisma.awardCertificate.create({
    data: { userId: targetUserId, tier, nominationId, svgData },
  });

  // Notify the recipient
  const cfg = TIER_CONFIG[tier];
  await createMentorshipNotification({
    userId: targetUserId,
    title: `${cfg?.emoji ?? ""} ${cfg?.label ?? tier} Award Certificate Ready`,
    body: `Congratulations! Your ${cfg?.label ?? tier} tier certificate is ready to download from your achievement dashboard.`,
    link: "/my-program/achievement-journey",
  });

  // For Gold+ tiers, notify admins (board notification)
  if (tier === "GOLD" || tier === "LIFETIME") {
    const admins = await prisma.user.findMany({
      where: { roles: { some: { role: "ADMIN" } } },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        createMentorshipNotification({
          userId: admin.id,
          title: `${cfg?.emoji ?? ""} ${cfg?.label ?? tier} Tier Achiever: ${user.name}`,
          body: `${user.name} has reached ${cfg?.label ?? tier} tier in the YPP Mentorship Program. Consider recognizing them at the next board meeting.`,
          link: `/admin/mentorship-program`,
        })
      )
    );
  }

  revalidatePath("/my-program/achievement-journey");
  return { success: true, certificateId: certificate.id };
}

/**
 * Get a stored certificate by ID for display/download.
 */
export async function getCertificate(certificateId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const certificate = await prisma.awardCertificate.findUnique({
    where: { id: certificateId },
  });

  if (!certificate) return null;
  if (certificate.userId !== userId && !isAdmin) return null;

  return {
    id: certificate.id,
    tier: certificate.tier,
    svgData: certificate.svgData,
    issuedAt: certificate.issuedAt.toISOString(),
  };
}

// ============================================
// VOLUNTEER HOURS LETTER
// ============================================

/**
 * Generate a volunteer hours verification letter for Silver+ tiers.
 */
export async function generateVolunteerHoursLetter() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  const [user, summary, mentorship] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        chapter: { select: { name: true } },
      },
    }),
    prisma.achievementPointSummary.findUnique({
      where: { userId },
      select: { totalPoints: true, currentTier: true },
    }),
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        startDate: true,
        mentor: { select: { name: true } },
        selfReflections: { select: { id: true } },
      },
    }),
  ]);

  if (!user || !summary?.currentTier) return null;

  const tier = summary.currentTier;
  if (tier !== "SILVER" && tier !== "GOLD" && tier !== "LIFETIME") return null;

  const cfg = TIER_CONFIG[tier];
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const programMonths = mentorship?.startDate
    ? Math.round((new Date().getTime() - mentorship.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  return {
    recipientName: user.name,
    recipientEmail: user.email,
    tier,
    tierLabel: cfg.label,
    volunteerHours: cfg.volunteerHours,
    totalPoints: summary.totalPoints,
    reflectionCount: mentorship?.selfReflections.length ?? 0,
    programMonths,
    mentorName: mentorship?.mentor?.name ?? null,
    chapterName: user.chapter?.name ?? null,
    issuedDate: today,
    letterText: `
To Whom It May Concern,

This letter certifies that ${user.name} has actively participated in the Young Professionals Program (YPP) Mentorship Achievement Program${user.chapter?.name ? ` through the ${user.chapter.name} Chapter` : ""}.

${user.name} has demonstrated exceptional commitment to personal and professional development, earning the ${cfg.label} Tier award with ${summary.totalPoints} achievement points${programMonths ? ` over ${programMonths} months of program participation` : ""}.

Based on program participation, peer recognition, and mentorship engagement, we estimate that ${user.name} has contributed approximately ${cfg.volunteerHours} volunteer/community service hours to YPP activities, including:
- Monthly self-reflection and goal-setting exercises (${mentorship?.selfReflections.length ?? 0} completed cycles)
- Active mentorship sessions with ${mentorship?.mentor?.name ?? "their assigned mentor"}
- Collaborative activities and peer recognition contributions

This letter may be used for college applications, scholarship applications, or other purposes that require documentation of community involvement.

Issued: ${today}

Sincerely,
Young Professionals Program
Mentorship Achievement Program
    `.trim(),
  };
}

// ============================================
// RECOMMENDATION LETTER TEMPLATE
// ============================================

/**
 * Generate a recommendation letter template for Silver+ mentees.
 */
export async function generateRecommendationTemplate(menteeId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  // Only the assigned mentor or admin can generate recommendation letters
  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId, status: "ACTIVE" },
    include: {
      mentee: {
        select: {
          name: true,
          email: true,
          chapter: { select: { name: true } },
        },
      },
      mentor: { select: { name: true, email: true } },
      selfReflections: {
        select: {
          id: true,
          goalReview: { select: { overallRating: true, pointsAwarded: true } },
        },
      },
    },
  });

  if (!mentorship) return null;
  if (mentorship.mentorId !== userId && !isAdmin) return null;

  const summary = await prisma.achievementPointSummary.findUnique({
    where: { userId: menteeId },
    select: { totalPoints: true, currentTier: true },
  });

  if (!summary?.currentTier) return null;
  const tier = summary.currentTier;
  if (tier !== "SILVER" && tier !== "GOLD" && tier !== "LIFETIME") return null;

  const cfg = TIER_CONFIG[tier];
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const completedCycles = mentorship.selfReflections.filter((r) => r.goalReview).length;

  const aboveAndBeyondCount = mentorship.selfReflections.filter(
    (r) => r.goalReview?.overallRating === "ABOVE_AND_BEYOND"
  ).length;

  return {
    menteeName: mentorship.mentee.name,
    menteeEmail: mentorship.mentee.email,
    mentorName: mentorship.mentor.name,
    tier,
    tierLabel: cfg.label,
    chapterName: mentorship.mentee.chapter?.name ?? null,
    issuedDate: today,
    templateText: `
[Date: ${today}]

Dear Admissions Committee / Scholarship Review Board,

I am honored to recommend ${mentorship.mentee.name} for your consideration. I have had the privilege of serving as their mentor through the Young Professionals Program (YPP)${mentorship.mentee.chapter?.name ? `, ${mentorship.mentee.chapter.name} Chapter` : ""}, and I can attest with confidence to their remarkable character, dedication, and potential.

During our mentorship, ${mentorship.mentee.name} completed ${completedCycles} structured monthly goal cycles, earning the prestigious ${cfg.label} Tier award with ${summary.totalPoints} achievement points — placing them among the top performers in our program. ${aboveAndBeyondCount > 0 ? `Notably, they received an "Above & Beyond" rating in ${aboveAndBeyondCount} review cycle${aboveAndBeyondCount > 1 ? "s" : ""}, demonstrating consistent excellence beyond expectations.` : ""}

What sets ${mentorship.mentee.name.split(" ")[0]} apart is their [ADD SPECIFIC QUALITIES]. In our sessions, they consistently [ADD SPECIFIC EXAMPLES]. When faced with [ADD CHALLENGE], they demonstrated [ADD QUALITY].

Their commitment to the YPP mentorship program reflects the same qualities that will make them successful in your program: intellectual curiosity, resilience, and a genuine desire to grow and contribute to their community.

I recommend ${mentorship.mentee.name.split(" ")[0]} without reservation and am confident they will be an exceptional addition to your program.

Sincerely,

${mentorship.mentor.name}
YPP Mentor${mentorship.mentee.chapter?.name ? ` — ${mentorship.mentee.chapter.name} Chapter` : ""}
${mentorship.mentor.email}
    `.trim(),
  };
}
