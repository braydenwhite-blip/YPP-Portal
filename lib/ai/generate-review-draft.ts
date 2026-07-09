import Anthropic from "@anthropic-ai/sdk";
import examples from "./mentorship-examples.json";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ReviewGoalInput {
  id: string;
  title: string;
  description: string | null;
  progressMade: string;
  accomplishments: string;
  blockers: string | null;
  nextMonthPlans: string;
  objectiveAchieved: boolean;
  hasReflection?: boolean; // false when no mentee reflection exists for this goal
}

/** A fixed rubric row (e.g. "Curriculum & Class Delivery") re-rated every cycle. */
export interface ReviewCompetencyInput {
  id: string;
  title: string;
  description: string | null;
  priorRating: string | null;
}

/**
 * A labeled input the AI may cite as a source for a suggestion. Each entry
 * carries a stable key (e.g. "comment:<requestId>", "action:<id>",
 * "checkin:<id>") so suggestions can say which specific inputs they drew
 * from — evidence-grounded rather than opaque generated prose.
 */
export interface LabeledEvidenceInput {
  key: string;
  label: string;
  body: string;
}

export interface PriorReview {
  cycleNumber: number;
  overallRating: string;
  overallComments: string;
  goalRatings: Array<{
    title: string;
    rating: string;
    comments: string | null;
  }>;
}

export interface ReviewDraftInput {
  menteeName: string;
  menteeRole: string;
  cycleNumber: number;
  goals: ReviewGoalInput[];
  priorReviews: PriorReview[];
  /** Fixed competency rubric rows, when this review's template has them. */
  competencies?: ReviewCompetencyInput[];
  /** Leadership-authorized only — never passed for a non-leadership caller. */
  collaboratorComments?: LabeledEvidenceInput[];
  /** Actions/check-ins linked to a goal — narrow, labeled evidence, not a dump. */
  evidence?: LabeledEvidenceInput[];
}

export interface ReviewDraftOutput {
  overallComments: string;
  planOfAction: string;
  /** Keyed by goal id */
  perGoalComments: Record<string, string>;
  /** Keyed by goal id — suggested rating based on reflection */
  perGoalSuggestedRating?: Record<string, string>;
  /** Keyed by competency id */
  perCompetencyComments?: Record<string, string>;
  /** Keyed by competency id — suggested rating */
  perCompetencySuggestedRating?: Record<string, string>;
  /** Short leadership-facing summary of what the collaborator comments/evidence say. */
  synthesisSummary?: string;
  /**
   * Keyed by the SAME ids as perGoalComments/perCompetencyComments (plus
   * "overallComments"/"planOfAction"/"synthesisSummary" for the whole-review
   * fields) — which labeled input keys (from goals/competencies/
   * collaboratorComments/evidence) each suggestion drew from. Sanitized down
   * to keys actually supplied; rendered as "based on: …" chips so leadership
   * can distinguish evidence from generated prose without a citation system.
   */
  sources?: Record<string, string[]>;
}

const SYSTEM_PROMPT = `You are a mentor review assistant for the Youth Passion Project (YPP) portal. Your role is to draft initial feedback comments AND suggest performance ratings to help mentors write high-quality, consistent monthly goal reviews for their mentees.

YPP has four performance rating levels (use these exact strings):
- BEHIND_SCHEDULE: Behind timetable with no realistic catch-up path this cycle
- GETTING_STARTED: Behind but catch-up is achievable with focused effort
- ACHIEVED: Goals completed in line with schedule and expectations
- ABOVE_AND_BEYOND: Significantly exceeds goals in both quantity and quality

Rating guidance:
- Default to GETTING_STARTED when reflection is thin or unclear
- Use ACHIEVED when the mentee explicitly describes completed objectives
- Use ABOVE_AND_BEYOND only when the reflection shows clear over-delivery
- Use BEHIND_SCHEDULE when blockers are unresolved and goals are missed with no recovery plan
- When hasReflection is false, suggest GETTING_STARTED and note that no reflection was provided

Your drafts should:
1. Be professional, specific, and grounded in the mentee's actual reflection
2. Acknowledge effort and progress, not just outcomes
3. Call out patterns across cycles when prior reviews show trends
4. Be honest about underperformance while remaining constructive and human
5. Keep overall comments to 3–5 sentences maximum
6. Keep each per-goal comment to 2–3 sentences maximum
7. Keep plan of action as a numbered list of 3–5 concrete, actionable items
8. NEVER fabricate facts not mentioned in the reflection or history
9. Reference prior cycle trends when they exist (e.g. "continuing from last cycle's...")

When competencies, collaborator comments, or evidence (linked actions/check-ins) are provided:
10. Rate and comment on each competency the same way you do for goals — grounded only in what's provided
11. Write a short synthesisSummary of what the collaborator comments and evidence say, for leadership's eyes only
12. For every suggested field (per-goal, per-competency, overallComments, planOfAction, synthesisSummary), include a "sources" entry listing the exact input keys you drew from (e.g. "reflection:progress", "comment:abc123", "action:xyz789") — every suggestion must be traceable to a specific input, never invented

You will respond ONLY with valid JSON — no preamble, no explanation.`;

function buildExamplesBlock(): string {
  return examples.examples
    .map((ex) => {
      const goalsText = ex.goals
        .map(
          (g) =>
            `  Goal: "${g.title}"
  Progress: ${g.progressMade}
  Accomplishments: ${g.accomplishments}
  Blockers: ${g.blockers ?? "None"}
  Next month plans: ${g.nextMonthPlans}
  Objective achieved: ${g.objectiveAchieved}`
        )
        .join("\n\n");

      const priorText =
        ex.priorReviews.length > 0
          ? ex.priorReviews
              .map(
                (pr) =>
                  `  Cycle ${pr.cycleNumber} (${pr.overallRating}): ${pr.overallComments}`
              )
              .join("\n")
          : "  None (first review)";

      const perGoalCommentsText = Object.entries(ex.idealReview.perGoalComments)
        .map(([title, comment]) => `    "${title}": "${comment}"`)
        .join(",\n");

      return `=== Example: ${ex.label} ===
MENTEE ROLE: ${ex.menteeRole}
CYCLE: ${ex.cycleNumber}
OVERALL RATING: ${ex.overallRating}

GOALS AND REFLECTION:
${goalsText}

PRIOR REVIEW HISTORY:
${priorText}

IDEAL DRAFT OUTPUT:
{
  "overallComments": "${ex.idealReview.overallComments.replace(/"/g, '\\"')}",
  "planOfAction": "${ex.idealReview.planOfAction.replace(/"/g, '\\"')}",
  "perGoalComments": {
${perGoalCommentsText}
  }
}`;
    })
    .join("\n\n");
}

function buildUserPrompt(input: ReviewDraftInput): string {
  const goalsText = input.goals
    .map(
      (g) =>
        `  Goal ID: "${g.id}"
  Goal Title: "${g.title}"
  Description: ${g.description ?? "N/A"}
  Has reflection: ${g.hasReflection !== false ? "yes" : "NO — mentee did not reflect on this goal"}
  Progress: ${g.progressMade || "(none)"}
  Accomplishments: ${g.accomplishments || "(none)"}
  Blockers: ${g.blockers ?? "None"}
  Next month plans: ${g.nextMonthPlans || "(none)"}
  Objective achieved: ${g.objectiveAchieved}`
    )
    .join("\n\n");

  const priorText =
    input.priorReviews.length > 0
      ? input.priorReviews
          .map(
            (pr) =>
              `  Cycle ${pr.cycleNumber} (${pr.overallRating}): ${pr.overallComments}`
          )
          .join("\n")
      : "  None (first review)";

  const goalIds = input.goals.map((g) => `"${g.id}"`).join(", ");

  const competenciesText =
    input.competencies && input.competencies.length > 0
      ? input.competencies
          .map(
            (c) =>
              `  Competency ID: "${c.id}"
  Title: "${c.title}"
  Description: ${c.description ?? "N/A"}
  Prior rating: ${c.priorRating ?? "None (first review)"}`
          )
          .join("\n\n")
      : null;

  const evidenceText =
    input.evidence && input.evidence.length > 0
      ? input.evidence.map((e) => `  [${e.key}] ${e.label}: ${e.body}`).join("\n")
      : null;

  const commentsText =
    input.collaboratorComments && input.collaboratorComments.length > 0
      ? input.collaboratorComments.map((c) => `  [${c.key}] ${c.label}: ${c.body}`).join("\n")
      : null;

  const sections = [
    `Now draft a review for this mentee.`,
    `MENTEE: ${input.menteeName}\nROLE: ${input.menteeRole}\nCYCLE: ${input.cycleNumber}`,
    `GOALS AND REFLECTION (label each source as "goal:<id>" or "reflection:<goalId>"):\n${goalsText}`,
    `PRIOR REVIEW HISTORY:\n${priorText}`,
  ];
  if (competenciesText) {
    sections.push(`COMPETENCIES TO RATE (label each source as "competency:<id>"):\n${competenciesText}`);
  }
  if (evidenceText) {
    sections.push(`LINKED EVIDENCE — actions/check-ins tied to a specific goal (cite by the bracketed key):\n${evidenceText}`);
  }
  if (commentsText) {
    sections.push(`COLLABORATOR COMMENTS — confidential, leadership-only (cite by the bracketed key):\n${commentsText}`);
  }

  const outputShape: Record<string, unknown> = {
    overallComments: "...",
    planOfAction: "...",
    perGoalComments: Object.fromEntries(input.goals.map((g) => [g.id, "..."])),
    perGoalSuggestedRating: Object.fromEntries(
      input.goals.map((g) => [g.id, "BEHIND_SCHEDULE|GETTING_STARTED|ACHIEVED|ABOVE_AND_BEYOND"])
    ),
  };
  if (input.competencies && input.competencies.length > 0) {
    outputShape.perCompetencyComments = Object.fromEntries(input.competencies.map((c) => [c.id, "..."]));
    outputShape.perCompetencySuggestedRating = Object.fromEntries(
      input.competencies.map((c) => [c.id, "BEHIND_SCHEDULE|GETTING_STARTED|ACHIEVED|ABOVE_AND_BEYOND"])
    );
  }
  if (commentsText || evidenceText) {
    outputShape.synthesisSummary = "...";
  }
  outputShape.sources = { "<same keys as above>": ["reflection:...", "action:...", "comment:..."] };

  sections.push(
    `Return ONLY valid JSON with this exact shape (use the real ids as keys, not titles):\n${JSON.stringify(outputShape, null, 2)}\n\nThe perGoalComments/perGoalSuggestedRating keys must be exactly these goal ids: ${goalIds}.`
  );

  return sections.join("\n\n");
}

export async function generateMentorshipReviewDraft(
  input: ReviewDraftInput
): Promise<ReviewDraftOutput> {
  const examplesBlock = buildExamplesBlock();
  const userPrompt = buildUserPrompt(input);

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: `${SYSTEM_PROMPT}\n\nHere are examples of high-quality reviews to guide your drafting style:\n\n${examplesBlock}`,
        // Cache the stable system prompt + examples — they never change between calls
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip any markdown code fences if the model adds them
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: ReviewDraftOutput;
  try {
    parsed = JSON.parse(jsonText) as ReviewDraftOutput;
  } catch {
    throw new Error(
      `AI returned invalid JSON. Raw response: ${rawText.slice(0, 500)}`
    );
  }

  if (
    typeof parsed.overallComments !== "string" ||
    typeof parsed.planOfAction !== "string" ||
    typeof parsed.perGoalComments !== "object"
  ) {
    throw new Error("AI response missing required fields");
  }

  // Sanitize suggested ratings — only keep valid GoalRatingColor values
  const validRatings = new Set(["BEHIND_SCHEDULE", "GETTING_STARTED", "ACHIEVED", "ABOVE_AND_BEYOND"]);
  const sanitizeRatingMap = (
    map: Record<string, string> | undefined
  ): Record<string, string> | undefined => {
    if (!map || typeof map !== "object") return undefined;
    const sanitized: Record<string, string> = {};
    for (const [id, rating] of Object.entries(map)) {
      if (typeof rating === "string" && validRatings.has(rating)) sanitized[id] = rating;
    }
    return sanitized;
  };
  parsed.perGoalSuggestedRating = sanitizeRatingMap(parsed.perGoalSuggestedRating);
  parsed.perCompetencySuggestedRating = sanitizeRatingMap(parsed.perCompetencySuggestedRating);

  // Sanitize sources — only keep keys the model actually cites against the
  // real set of labeled inputs we supplied it, so a hallucinated key never
  // renders as if it were real evidence.
  if (parsed.sources && typeof parsed.sources === "object") {
    const knownKeys = new Set<string>([
      ...input.goals.map((g) => `goal:${g.id}`),
      ...input.goals.map((g) => `reflection:${g.id}`),
      ...(input.competencies ?? []).map((c) => `competency:${c.id}`),
      ...(input.collaboratorComments ?? []).map((c) => c.key),
      ...(input.evidence ?? []).map((e) => e.key),
    ]);
    const sanitizedSources: Record<string, string[]> = {};
    for (const [field, keys] of Object.entries(parsed.sources)) {
      if (!Array.isArray(keys)) continue;
      const filtered = keys.filter((k): k is string => typeof k === "string" && knownKeys.has(k));
      if (filtered.length > 0) sanitizedSources[field] = filtered;
    }
    parsed.sources = sanitizedSources;
  } else {
    parsed.sources = undefined;
  }

  return parsed;
}
