"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";

// ============================================
// TIER CONFIGURATION
// ============================================

const TIER_CONFIG: Record<string, {
  label: string;
  color: string;
  accentColor: string;
  emoji: string;
  description: string;
  volunteerHours: number;
}> = {
  BRONZE: {
    label: "Bronze",
    color: "#cd7f32",
    accentColor: "#92400e",
    emoji: "🥉",
    description: "Emerging Leader",
    volunteerHours: 5,
  },
  SILVER: {
    label: "Silver",
    color: "#9ca3af",
    accentColor: "#374151",
    emoji: "🥈",
    description: "Dedicated Achiever",
    volunteerHours: 10,
  },
  GOLD: {
    label: "Gold",
    color: "#f59e0b",
    accentColor: "#92400e",
    emoji: "🥇",
    description: "Excellence Award",
    volunteerHours: 20,
  },
  LIFETIME: {
    label: "Lifetime",
    color: "#7c3aed",
    accentColor: "#4c1d95",
    emoji: "👑",
    description: "Lifetime Achievement",
    volunteerHours: 40,
  },
};

// ============================================
// SVG CERTIFICATE GENERATION
// ============================================

/**
 * Generate an SVG certificate string for the given award tier.
 */
export function generateCertificateSvg(params: {
  recipientName: string;
  tier: string;
  issuedDate: string;
  mentorName?: string | null;
  chapterName?: string | null;
}): string {
  const { recipientName, tier, issuedDate, mentorName, chapterName } = params;
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.BRONZE;

  const formattedDate = new Date(issuedDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" width="800" height="560" font-family="Georgia, serif">
  <!-- Background -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#faf9ff"/>
      <stop offset="100%" stop-color="#f3f0ff"/>
    </linearGradient>
    <linearGradient id="tierGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${cfg.color}"/>
      <stop offset="100%" stop-color="${cfg.accentColor}"/>
    </linearGradient>
  </defs>

  <!-- Border frame -->
  <rect width="800" height="560" fill="url(#bg)" rx="12"/>
  <rect x="12" y="12" width="776" height="536" fill="none" stroke="${cfg.color}" stroke-width="3" rx="8"/>
  <rect x="20" y="20" width="760" height="520" fill="none" stroke="${cfg.color}" stroke-width="1" opacity="0.4" rx="6"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="800" height="8" fill="url(#tierGrad)" rx="12"/>

  <!-- YPP Logo area -->
  <text x="400" y="68" text-anchor="middle" font-size="13" fill="${cfg.accentColor}" letter-spacing="4" font-family="Arial, sans-serif" font-weight="700">YOUNG PROFESSIONALS PROGRAM</text>
  <line x1="200" y1="78" x2="600" y2="78" stroke="${cfg.color}" stroke-width="1" opacity="0.5"/>

  <!-- Certificate title -->
  <text x="400" y="120" text-anchor="middle" font-size="36" fill="#1e1b4b" font-style="italic">Certificate of Achievement</text>

  <!-- Tier badge -->
  <rect x="320" y="138" width="160" height="36" fill="url(#tierGrad)" rx="18"/>
  <text x="400" y="162" text-anchor="middle" font-size="16" fill="white" font-family="Arial, sans-serif" font-weight="700" letter-spacing="2">${cfg.emoji} ${cfg.label.toUpperCase()}</text>

  <!-- "This certifies that" -->
  <text x="400" y="218" text-anchor="middle" font-size="14" fill="#6b7280" font-family="Arial, sans-serif" font-style="italic">This certifies that</text>

  <!-- Recipient name -->
  <text x="400" y="268" text-anchor="middle" font-size="42" fill="#1e1b4b" font-weight="bold">${escapeXml(recipientName)}</text>
  <line x1="180" y1="280" x2="620" y2="280" stroke="${cfg.color}" stroke-width="1.5"/>

  <!-- Achievement description -->
  <text x="400" y="316" text-anchor="middle" font-size="14" fill="#374151" font-family="Arial, sans-serif">
    has earned the <tspan font-weight="700" fill="${cfg.accentColor}">${cfg.label} Tier — ${cfg.description}</tspan> award
  </text>
  <text x="400" y="338" text-anchor="middle" font-size="14" fill="#374151" font-family="Arial, sans-serif">in the YPP Mentorship Achievement Program</text>

  ${mentorName ? `<text x="400" y="366" text-anchor="middle" font-size="13" fill="#6b7280" font-family="Arial, sans-serif">Mentored by ${escapeXml(mentorName)}${chapterName ? ` · ${escapeXml(chapterName)} Chapter` : ""}</text>` : ""}

  <!-- Decorative stars -->
  <text x="160" y="270" text-anchor="middle" font-size="28" fill="${cfg.color}" opacity="0.6">✦</text>
  <text x="640" y="270" text-anchor="middle" font-size="28" fill="${cfg.color}" opacity="0.6">✦</text>
  <text x="100" y="200" text-anchor="middle" font-size="18" fill="${cfg.color}" opacity="0.3">✦</text>
  <text x="700" y="200" text-anchor="middle" font-size="18" fill="${cfg.color}" opacity="0.3">✦</text>

  <!-- Date and signature area -->
  <line x1="100" y1="470" x2="300" y2="470" stroke="#d1d5db" stroke-width="1"/>
  <text x="200" y="488" text-anchor="middle" font-size="11" fill="#9ca3af" font-family="Arial, sans-serif">Date of Issue</text>
  <text x="200" y="504" text-anchor="middle" font-size="13" fill="#374151" font-family="Arial, sans-serif">${formattedDate}</text>

  <line x1="500" y1="470" x2="700" y2="470" stroke="#d1d5db" stroke-width="1"/>
  <text x="600" y="488" text-anchor="middle" font-size="11" fill="#9ca3af" font-family="Arial, sans-serif">Program Director</text>
  <text x="600" y="504" text-anchor="middle" font-size="13" fill="#374151" font-family="Arial, sans-serif" font-style="italic">Young Professionals Program</text>

  <!-- Bottom watermark -->
  <text x="400" y="540" text-anchor="middle" font-size="10" fill="#d1d5db" font-family="Arial, sans-serif" letter-spacing="1">YPP · ACHIEVEMENT PROGRAM · ${new Date(issuedDate).getFullYear()}</text>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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
