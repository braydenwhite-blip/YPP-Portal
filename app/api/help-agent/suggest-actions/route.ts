import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { checkRateLimit } from "@/lib/rate-limit-redis";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { isOfficerTier } from "@/lib/people-strategy/action-permissions";
import { getMeetingById } from "@/lib/people-strategy/meetings-queries";
import { getActionsForMeeting } from "@/lib/people-strategy/action-queries";
import {
  parseSuggestedActions,
  type SuggestPerson,
  type SuggestedAction,
} from "@/lib/people-strategy/notes-to-actions";
import {
  extractSuggestedActionsWithAI,
  isNotesAIConfigured,
} from "@/lib/people-strategy/notes-to-actions-ai";

export const dynamic = "force-dynamic";

/**
 * Smart notes → actions — the "Review suggested actions" endpoint.
 *
 * Reads a meeting's notes server-side and returns reviewable suggested actions.
 * Deterministic by default (heuristic parser); when the officer opts in AND AI
 * is configured, it uses the AI extractor and falls back to the parser on any
 * failure. The user confirms/edits/ignores in the UI — nothing is created here.
 */
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

  let meetingId: string;
  let useAI = false;
  try {
    const body = (await request.json()) as { meetingId?: unknown; useAI?: unknown };
    if (typeof body.meetingId !== "string" || !body.meetingId.trim()) {
      return NextResponse.json({ error: "meetingId is required" }, { status: 400 });
    }
    meetingId = body.meetingId.trim();
    useAI = body.useAI === true;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const baseLimit = await checkRateLimit(`cos-suggest:${viewer.id}`, 60, 60 * 60 * 1000);
  if (!baseLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const meeting = await getMeetingById(meetingId).catch(() => null);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const notes = meeting.notesText ?? "";
  const meetingDateISO = meeting.date ? meeting.date.toISOString() : null;

  // Valid owners = attendees + facilitator (people the notes are likely to name).
  const peopleMap = new Map<string, SuggestPerson>();
  for (const a of meeting.attendees) {
    const name = a.user?.name ?? a.user?.email ?? null;
    if (a.user?.id && name) peopleMap.set(a.user.id, { id: a.user.id, name });
  }
  if (meeting.facilitator?.id) {
    const name = meeting.facilitator.name ?? meeting.facilitator.email ?? null;
    if (name) peopleMap.set(meeting.facilitator.id, { id: meeting.facilitator.id, name });
  }
  const people = [...peopleMap.values()];

  const existingActions = await getActionsForMeeting(meetingId, viewer).catch(() => []);
  const existingTitles = existingActions.map((a) => a.title);

  const aiAvailable = isNotesAIConfigured();
  let suggestions: SuggestedAction[] | null = null;
  let aiUsed = false;

  if (useAI && aiAvailable) {
    const aiLimit = await checkRateLimit(`cos-suggest-ai:${viewer.id}`, 30, 60 * 60 * 1000);
    const aiGlobal = await checkRateLimit("cos-suggest-ai:global", 800, 24 * 60 * 60 * 1000);
    if (aiLimit.success && aiGlobal.success) {
      const ai = await extractSuggestedActionsWithAI({ notes, people, meetingDateISO });
      if (ai) {
        // Dedupe AI output against work already tracked for this meeting.
        const existingNorm = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
        suggestions = ai.filter((s) => !existingNorm.has(s.title.trim().toLowerCase()));
        aiUsed = true;
      }
    }
  }

  if (!suggestions) {
    suggestions = parseSuggestedActions({ notes, people, meetingDateISO, existingTitles });
  }

  return NextResponse.json({ suggestions, aiUsed, aiAvailable });
}
