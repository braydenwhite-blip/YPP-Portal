import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { checkRateLimit } from "@/lib/rate-limit-redis";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { isOfficerTier } from "@/lib/people-strategy/action-permissions";
import { loadData360 } from "@/lib/operations/data-360-queries";
import { loadEntity360 } from "@/lib/operations/entity-360-queries";
import { isEntity360Type } from "@/lib/operations/entity-360";
import {
  buildChiefOfStaffAnswer,
  buildEntitySummaryAnswer,
  shouldScopeAnswerToEntity,
} from "@/lib/help-agent/chief-of-staff";
import { answerChapterQuestion, isChapterQuestion } from "@/lib/help-agent/chapter-answers";
import { isChapterLeadership } from "@/lib/chapters/access";
import { isChiefOfStaffAIConfigured, narrateChiefOfStaffAnswer } from "@/lib/help-agent/ask-ai";
import type { CoSAnswer } from "@/lib/help-agent/types";

export const dynamic = "force-dynamic";

/**
 * Help Agent — the Chief of Staff "Ask" endpoint.
 *
 * GET  → capabilities ({ aiAvailable }) so the UI knows whether to offer the
 *        optional AI toggle.
 * POST → a structured CoSAnswer for a natural-language question.
 *
 * Deterministic-FIRST: the answer is always computed from the portal's existing
 * derivation engine (`loadData360` / `loadEntity360`). The optional AI layer
 * only adds a grounded narrative when the key is configured AND the officer
 * opted in — and it fails open to the deterministic answer.
 */

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ aiAvailable: isChiefOfStaffAIConfigured() });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isActionTrackerEnabled()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  if (!isOfficerTier(viewer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse + validate the body.
  let question: string;
  let useAI = false;
  let context: { entityType?: string; entityId?: string } | undefined;
  try {
    const body = (await request.json()) as {
      question?: unknown;
      useAI?: unknown;
      context?: { entityType?: unknown; entityId?: unknown };
    };
    if (typeof body.question !== "string" || body.question.trim().length === 0) {
      return NextResponse.json({ error: "A question is required" }, { status: 400 });
    }
    question = body.question.trim().slice(0, 400);
    useAI = body.useAI === true;
    if (
      body.context &&
      typeof body.context.entityType === "string" &&
      typeof body.context.entityId === "string"
    ) {
      context = { entityType: body.context.entityType, entityId: body.context.entityId };
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Light abuse limit on every ask; a stricter limit when AI runs (cost).
  const baseLimit = await checkRateLimit(`cos-ask:${viewer.id}`, 120, 60 * 60 * 1000);
  if (!baseLimit.success) {
    return NextResponse.json(
      { error: "Too many questions. Please wait a moment." },
      { status: 429 }
    );
  }

  const aiAvailable = isChiefOfStaffAIConfigured();
  const now = new Date();

  // Build the deterministic answer.
  let answer: CoSAnswer;
  try {
    // Entity context wins first: the ask came from a specific record ("Ask
    // about this"), so even a question containing the word "chapter" (e.g.
    // "Summarize this chapter.") must answer about THAT record, not the
    // network-wide chapter roll-up. Load the entity first so the scope check
    // can also match its title; a clearly global question still falls through.
    let entityAnswer: CoSAnswer | null = null;
    if (context && isEntity360Type(context.entityType)) {
      const entity = await loadEntity360(context.entityType, context.entityId!, viewer, { now });
      if (entity && shouldScopeAnswerToEntity(question, entity.title)) {
        entityAnswer = buildEntitySummaryAnswer(question, entity, { now, aiAvailable });
      }
    }
    if (entityAnswer) {
      answer = entityAnswer;
    } else if (isChapterQuestion(question) && isChapterLeadership(session.user)) {
      // Chapter questions get real chapter data — but only for chapter leadership,
      // so a CP/officer can't pull the whole network's chapter picture this way.
      const chapterAnswer = await answerChapterQuestion(question, { now, aiAvailable });
      if (chapterAnswer) {
        answer = chapterAnswer;
      } else {
        const data = await loadData360(viewer, { now });
        answer = buildChiefOfStaffAnswer(question, data, { now, aiAvailable });
      }
    } else {
      const data = await loadData360(viewer, { now });
      answer = buildChiefOfStaffAnswer(question, data, { now, aiAvailable });
    }
  } catch (err) {
    console.error("[chief-of-staff] failed to build answer:", err);
    return NextResponse.json({ error: "Failed to build answer" }, { status: 500 });
  }

  // Optional AI narration (additive, fails open).
  if (useAI && aiAvailable) {
    const aiLimit = await checkRateLimit(`cos-ask-ai:${viewer.id}`, 40, 60 * 60 * 1000);
    const aiGlobal = await checkRateLimit("cos-ask-ai:global", 1000, 24 * 60 * 60 * 1000);
    if (aiLimit.success && aiGlobal.success) {
      const narrative = await narrateChiefOfStaffAnswer(answer);
      if (narrative) {
        answer = { ...answer, narrative, aiUsed: true };
      }
    }
  }

  return NextResponse.json(answer);
}
