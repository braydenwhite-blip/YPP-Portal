import { NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit-redis";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { generateMentorshipReviewDraft } from "@/lib/ai/generate-review-draft";
import type { ReviewGoalInput, PriorReview } from "@/lib/ai/generate-review-draft";

/** Extract the real client IP from proxy headers (same pattern as /api/upload/applicant-video). */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const isMentor =
    roles.includes("MENTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_PRESIDENT");
  if (!isMentor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // ── Extract IP early so it's available for rate-limit keys and audit log ──
  const ip = getClientIp(request);

  // ── Rate limit: 20 drafts per hour per user ───────────────────────────────
  const rateResult = await checkRateLimit(
    `ai-review-draft:${session.user.id}`,
    20,
    60 * 60 * 1000
  );
  if (!rateResult.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before generating another draft." },
      { status: 429 }
    );
  }

  // ── Rate limit: 50 drafts per hour per IP (multi-account abuse defense) ───
  const ipRateResult = await checkRateLimit(
    `ai-review-draft-ip:${ip}`,
    50,
    60 * 60 * 1000
  );
  if (!ipRateResult.success) {
    return NextResponse.json(
      { error: "Too many requests from this network. Please try again later." },
      { status: 429 }
    );
  }

  // ── Rate limit: 500 drafts per day globally (cost protection) ────────────
  const globalRateResult = await checkRateLimit(
    "ai-review-draft:global",
    500,
    24 * 60 * 60 * 1000
  );
  if (!globalRateResult.success) {
    return NextResponse.json(
      { error: "Daily AI draft limit reached. Please try again tomorrow." },
      { status: 429 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let reflectionId: string;
  try {
    const body = (await request.json()) as { reflectionId?: string };
    if (!body.reflectionId || typeof body.reflectionId !== "string") {
      return NextResponse.json({ error: "reflectionId is required" }, { status: 400 });
    }
    reflectionId = body.reflectionId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Validate reflectionId is a CUID (c + 24 lowercase alphanumeric chars) ─
  if (!/^c[a-z0-9]{24}$/.test(reflectionId)) {
    return NextResponse.json({ error: "Invalid reflectionId format" }, { status: 400 });
  }

  // ── Fetch reflection (auth check included) ────────────────────────────────
  const reflection = await prisma.monthlySelfReflection.findUnique({
    where: { id: reflectionId },
    include: {
      mentee: { select: { id: true, name: true, primaryRole: true } },
      mentorship: { select: { mentorId: true } },
      goalResponses: {
        include: {
          goal: {
            select: { id: true, title: true, description: true, sortOrder: true },
          },
        },
        orderBy: { goal: { sortOrder: "asc" } },
      },
    },
  });

  if (!reflection) {
    return NextResponse.json({ error: "Reflection not found" }, { status: 404 });
  }

  const isAdmin = roles.includes("ADMIN");
  if (reflection.mentorship.mentorId !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // ── Fetch last 3 approved reviews for context ─────────────────────────────
  const priorReviewRows = await prisma.mentorGoalReview.findMany({
    where: {
      menteeId: reflection.menteeId,
      status: "APPROVED",
      cycleNumber: { lt: reflection.cycleNumber },
    },
    orderBy: { cycleNumber: "desc" },
    take: 3,
    include: {
      goalRatings: {
        include: { goal: { select: { title: true } } },
      },
    },
  });

  // ── Build input for AI ────────────────────────────────────────────────────
  const goals: ReviewGoalInput[] = reflection.goalResponses.map((gr) => ({
    id: gr.goal.id,
    title: gr.goal.title,
    description: gr.goal.description,
    progressMade: gr.progressMade,
    accomplishments: gr.accomplishments,
    blockers: gr.blockers,
    nextMonthPlans: gr.nextMonthPlans,
    objectiveAchieved: gr.objectiveAchieved,
  }));

  const priorReviews: PriorReview[] = priorReviewRows.map((r) => ({
    cycleNumber: r.cycleNumber,
    overallRating: r.overallRating,
    overallComments: r.overallComments,
    goalRatings: r.goalRatings.map((gr) => ({
      title: gr.goal?.title ?? "",
      rating: gr.rating,
      comments: gr.comments,
    })),
  }));

  // ── Generate draft ────────────────────────────────────────────────────────
  try {
    const draft = await generateMentorshipReviewDraft({
      menteeName: reflection.mentee.name ?? "this mentee",
      menteeRole: reflection.mentee.primaryRole ?? "INSTRUCTOR",
      cycleNumber: reflection.cycleNumber,
      goals,
      priorReviews,
    });

    // ── Audit log successful generation ──────────────────────────────────────
    await logAuditEvent({
      action: "AI_DRAFT_GENERATED" as AuditAction,
      actorId: session.user.id,
      targetType: "MonthlySelfReflection",
      targetId: reflectionId,
      description: `AI draft generated for ${reflection.mentee.name ?? "mentee"} (cycle ${reflection.cycleNumber})`,
      metadata: {
        menteeId: reflection.menteeId,
        menteeName: reflection.mentee.name,
        cycleNumber: reflection.cycleNumber,
        userRemainingDrafts: rateResult.remaining,
      },
      ipAddress: ip,
    });

    return NextResponse.json(draft);
  } catch (err) {
    console.error("[AI Draft] Generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate AI draft. Please try again." },
      { status: 500 }
    );
  }
}
