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
}

export interface ReviewDraftOutput {
  overallComments: string;
  planOfAction: string;
  /** Keyed by goal title */
  perGoalComments: Record<string, string>;
}

const SYSTEM_PROMPT = `You are a mentor review assistant for the Youth Passion Project (YPP) portal. Your role is to draft initial feedback comments to help mentors write high-quality, consistent monthly goal reviews for their mentees.

YPP has four performance rating levels:
- BEHIND_SCHEDULE: Behind timetable with no realistic catch-up path this cycle
- GETTING_STARTED: Behind but catch-up is achievable with focused effort
- ACHIEVED: Goals completed in line with schedule and expectations
- ABOVE_AND_BEYOND: Significantly exceeds goals in both quantity and quality

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
        `  Goal: "${g.title}"
  Description: ${g.description ?? "N/A"}
  Progress: ${g.progressMade}
  Accomplishments: ${g.accomplishments}
  Blockers: ${g.blockers ?? "None"}
  Next month plans: ${g.nextMonthPlans}
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

  const goalTitles = input.goals.map((g) => `"${g.title}"`).join(", ");

  return `Now draft a review for this mentee.

MENTEE: ${input.menteeName}
ROLE: ${input.menteeRole}
CYCLE: ${input.cycleNumber}

GOALS AND REFLECTION:
${goalsText}

PRIOR REVIEW HISTORY:
${priorText}

Return ONLY valid JSON with these exact keys:
{
  "overallComments": "...",
  "planOfAction": "...",
  "perGoalComments": {
    ${input.goals.map((g) => `"${g.title}": "..."`).join(",\n    ")}
  }
}

The perGoalComments object must have exactly these keys: ${goalTitles}.`;
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

  // Validate expected keys are present
  if (
    typeof parsed.overallComments !== "string" ||
    typeof parsed.planOfAction !== "string" ||
    typeof parsed.perGoalComments !== "object"
  ) {
    throw new Error("AI response missing required fields");
  }

  return parsed;
}
