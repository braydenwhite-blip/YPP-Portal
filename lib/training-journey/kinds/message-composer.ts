import { z } from "zod";
import type { BeatKindModule, BeatFeedback } from "../types";

// ---------------------------------------------------------------------------
// Local Zod schema for BeatFeedback
// ---------------------------------------------------------------------------

const FEEDBACK_SCHEMA: z.ZodType<BeatFeedback> = z.object({
  tone: z.enum(["correct", "partial", "incorrect", "noted"]),
  headline: z.string(),
  body: z.string(),
  hint: z.string().optional(),
  callouts: z
    .array(
      z.object({
        label: z.string(),
        target: z.union([z.string(), z.number()]),
      })
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Config + Response schemas
// ---------------------------------------------------------------------------

const snippetSchema = z.object({
  id: z.string(),
  label: z.string(),
  tags: z.array(z.string()),
});

const snippetPoolSchema = z.object({
  poolId: z.string(),
  label: z.string(),
  minSelections: z.number().int().nonnegative().optional(),
  maxSelections: z.number().int().positive().optional(),
  snippets: z.array(snippetSchema),
});

const configSchema = z
  .object({
    snippetPools: z.array(snippetPoolSchema).min(1).max(5),
    rubric: z.object({
      requiredTags: z.array(z.string()),
      bannedTags: z.array(z.string()),
    }),
    correctFeedback: FEEDBACK_SCHEMA,
    incorrectFeedback: z.record(z.string(), FEEDBACK_SCHEMA),
  })
  .superRefine((val, ctx) => {
    // Pool ids must be unique
    const poolIds = val.snippetPools.map((p) => p.poolId);
    const uniquePoolIds = new Set(poolIds);
    if (uniquePoolIds.size !== poolIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pool ids must be unique",
        path: ["snippetPools"],
      });
    }

    // Snippet ids must be unique across all pools
    const allSnippetIds: string[] = [];
    for (const pool of val.snippetPools) {
      for (const snippet of pool.snippets) {
        allSnippetIds.push(snippet.id);
      }
    }
    const uniqueSnippetIds = new Set(allSnippetIds);
    if (uniqueSnippetIds.size !== allSnippetIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Snippet ids must be unique across all pools",
        path: ["snippetPools"],
      });
    }

    // requiredTags and bannedTags must be disjoint
    const requiredSet = new Set(val.rubric.requiredTags);
    const bannedOverlap = val.rubric.bannedTags.filter((t) => requiredSet.has(t));
    if (bannedOverlap.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `requiredTags and bannedTags must be disjoint; overlap: ${bannedOverlap.join(", ")}`,
        path: ["rubric"],
      });
    }
  });

const responseSchema = z.object({
  selections: z.array(
    z.object({
      poolId: z.string(),
      snippetIds: z.array(z.string()),
    })
  ),
});

type MessageComposerConfig = z.infer<typeof configSchema>;
type MessageComposerResponse = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const scorer: BeatKindModule<MessageComposerConfig, MessageComposerResponse>["scorer"] = (
  beat,
  response
) => {
  const { config } = beat;
  const { snippetPools, rubric } = config;

  // Build a lookup map: poolId -> pool
  const poolMap = new Map(snippetPools.map((p) => ({ poolId: p.poolId, pool: p })).map((x) => [x.poolId, x.pool]));

  // Build snippet lookup: snippetId -> tags
  const snippetTagMap = new Map<string, string[]>();
  for (const pool of snippetPools) {
    for (const snippet of pool.snippets) {
      snippetTagMap.set(snippet.id, snippet.tags);
    }
  }

  // Validate pool selection counts and collect tags
  const pickedTags = new Set<string>();

  for (const pool of snippetPools) {
    const selection = response.selections.find((s) => s.poolId === pool.poolId);
    const selectedIds = selection?.snippetIds ?? [];
    const minSel = pool.minSelections ?? 1;
    const maxSel = pool.maxSelections ?? 1;

    if (selectedIds.length < minSel || selectedIds.length > maxSel) {
      return {
        correct: false,
        score: 0,
        feedback: {
          tone: "incorrect",
          headline: "Pick the right number of pieces",
          body: `The "${pool.label}" section requires between ${minSel} and ${maxSel} selection(s).`,
        },
      };
    }

    // Collect tags from known snippets (unknown ids silently ignored for tag union)
    for (const snippetId of selectedIds) {
      const tags = snippetTagMap.get(snippetId);
      if (tags) {
        for (const tag of tags) {
          pickedTags.add(tag);
        }
      }
    }
  }

  const missingRequired = rubric.requiredTags.filter((t) => !pickedTags.has(t));
  const bannedFound = rubric.bannedTags.filter((t) => pickedTags.has(t));

  const correct = missingRequired.length === 0 && bannedFound.length === 0;

  if (correct) {
    return {
      correct: true,
      score: beat.scoringWeight,
      feedback: { ...config.correctFeedback, tone: "correct" },
    };
  }

  // Banned tags present → score 0
  if (bannedFound.length > 0) {
    return {
      correct: false,
      score: 0,
      feedback: {
        ...(config.incorrectFeedback["default"]),
        callouts: bannedFound.map((tag) => ({ label: `Banned: ${tag}`, target: tag })),
      },
    };
  }

  // Partial: no banned tags, but missing some required
  const partialScore =
    rubric.requiredTags.length > 0
      ? Math.round(
          ((rubric.requiredTags.length - missingRequired.length) / rubric.requiredTags.length) *
            beat.scoringWeight
        )
      : 0;

  return {
    correct: false,
    score: partialScore,
    feedback: {
      tone: "partial",
      headline: "Almost there",
      body: `Your message is missing some key elements.`,
      callouts: missingRequired.map((tag) => ({ label: `Missing: ${tag}`, target: tag })),
    },
  };
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const MESSAGE_COMPOSER_MODULE: BeatKindModule<
  MessageComposerConfig,
  MessageComposerResponse
> = {
  kind: "MESSAGE_COMPOSER",
  schemaVersion: 1,
  configSchema,
  responseSchema,
  scorer,
};
