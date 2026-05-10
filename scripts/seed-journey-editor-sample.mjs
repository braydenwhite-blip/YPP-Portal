/**
 * Idempotent seed for the Admin Journey Editor sample.
 *
 * Upserts:
 *   - one Journey (slug = SAMPLE_JOURNEY_SLUG)
 *   - one DRAFT JourneyVersion v1
 *   - the 4 beats from prisma/fixtures/sample-journey.ts
 *   - one INSTRUCTOR assignment
 *
 * Re-running is safe: lookups use stable keys (slug + sourceKey).
 *
 * Usage:
 *   node scripts/seed-journey-editor-sample.mjs
 *
 * The fixture is the canonical good-state for editor smoke tests; the
 * matching TS source is `prisma/fixtures/sample-journey.ts`. The .mjs
 * here intentionally inlines the data to avoid a tsx loader dependency.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_JOURNEY_SLUG = "instructor-onboarding-sample";

const FB_CORRECT = {
  tone: "correct",
  headline: "Solid",
  body: "That matches the YPP standard.",
};
const FB_INCORRECT = {
  tone: "incorrect",
  headline: "Take another pass",
  body: "Not quite — review the prompt and try again.",
};

const BEATS = [
  {
    sourceKey: "intro-reflection",
    kind: "REFLECTION",
    title: "Why are you here?",
    prompt: "Write 1–2 sentences on why you joined YPP.",
    sortOrder: 1,
    config: {
      prompt: "Write 1–2 sentences on why you joined YPP.",
      correctFeedback: FB_CORRECT,
    },
  },
  {
    sourceKey: "session-flow-order",
    kind: "SORT_ORDER",
    title: "Order a strong session",
    prompt: "Drag the steps into the order they should happen in a session.",
    sortOrder: 2,
    config: {
      items: [
        { id: "warmup", label: "Warmup" },
        { id: "objective", label: "State objective" },
        { id: "practice", label: "Guided practice" },
        { id: "wrap", label: "Wrap & reflect" },
      ],
      correctOrder: ["warmup", "objective", "practice", "wrap"],
      partialCredit: true,
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  {
    sourceKey: "absent-student-fill",
    kind: "FILL_IN_BLANK",
    title: "Following up on a no-show",
    prompt:
      "Within ___ hours of a missed session, send a check-in to the student. (Type the number.)",
    sortOrder: 3,
    config: {
      prompt:
        "Within ___ hours of a missed session, send a check-in to the student. (Type the number.)",
      acceptedAnswers: ["24", "twenty-four"],
      caseSensitive: false,
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
      hint: "Same-day or next-day is the YPP standard.",
    },
  },
  {
    sourceKey: "support-archetypes-match",
    kind: "MATCH_PAIRS",
    title: "Match the situation to the response",
    prompt: "Pair each student moment with the right next move.",
    sortOrder: 4,
    config: {
      leftItems: [
        { id: "shy", label: "Shy student stays silent" },
        { id: "lost", label: "Student looks confused" },
        { id: "rushed", label: "Student finishes early" },
      ],
      rightItems: [
        { id: "invite", label: "Invite a structured turn" },
        { id: "rephrase", label: "Rephrase the objective" },
        { id: "stretch", label: "Offer a stretch challenge" },
      ],
      correctPairs: [
        { leftId: "shy", rightId: "invite" },
        { leftId: "lost", rightId: "rephrase" },
        { leftId: "rushed", rightId: "stretch" },
      ],
      partialCredit: true,
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
];

async function main() {
  const journey = await prisma.journey.upsert({
    where: { slug: SAMPLE_JOURNEY_SLUG },
    create: {
      slug: SAMPLE_JOURNEY_SLUG,
      title: "Instructor Onboarding (Sample)",
      description:
        "Editor smoke fixture. Exercises REFLECTION, SORT_ORDER, FILL_IN_BLANK, and MATCH_PAIRS beats.",
    },
    update: {},
  });

  let version = await prisma.journeyVersion.findUnique({
    where: {
      journeyId_versionNumber: { journeyId: journey.id, versionNumber: 1 },
    },
  });
  if (!version) {
    version = await prisma.journeyVersion.create({
      data: {
        journeyId: journey.id,
        versionNumber: 1,
        status: "DRAFT",
        estimatedMinutes: 12,
        passScorePct: 80,
        strictMode: false,
      },
    });
  }

  for (const beat of BEATS) {
    const existing = await prisma.interactiveBeat.findFirst({
      where: { journeyVersionId: version.id, sourceKey: beat.sourceKey },
    });
    if (existing) {
      await prisma.interactiveBeat.update({
        where: { id: existing.id },
        data: {
          title: beat.title,
          prompt: beat.prompt,
          sortOrder: beat.sortOrder,
          kind: beat.kind,
          config: beat.config,
          schemaVersion: 1,
          removedAt: null,
        },
      });
    } else {
      // The legacy `journeyId` FK on InteractiveBeat is non-nullable, but the
      // sample journey has no matching InteractiveJourney. We point it at a
      // synthetic journeyId == version.id so the FK row is satisfied via the
      // editor-side journeyVersionId. (The legacy journeyId is unused for
      // editor-only journeys; the runtime resolver in Commit 12 reads via
      // journeyVersionId.)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "InteractiveBeat" (
           "id","journeyId","journeyVersionId","sourceKey","sortOrder","kind",
           "title","prompt","config","schemaVersion","scoringWeight","createdAt","updatedAt"
         ) VALUES (
           gen_random_uuid()::text, $1, $1, $2, $3, $4::"InteractiveBeatKind",
           $5, $6, $7::jsonb, 1, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )`,
        version.id,
        beat.sourceKey,
        beat.sortOrder,
        beat.kind,
        beat.title,
        beat.prompt,
        JSON.stringify(beat.config),
      );
    }
  }

  await prisma.journeyAssignmentRule.upsert({
    where: {
      journeyId_audience: { journeyId: journey.id, audience: "INSTRUCTOR" },
    },
    create: { journeyId: journey.id, audience: "INSTRUCTOR", autoEnroll: false },
    update: {},
  });

  console.log(
    `Sample journey upserted: slug=${SAMPLE_JOURNEY_SLUG} version=${version.id} beats=${BEATS.length}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
