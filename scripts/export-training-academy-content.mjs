import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  fallbackKey,
  parseArgs,
  writeJsonFile,
  DEFAULT_CONTENT_FILE,
} from "./training-academy-content-utils.mjs";

const DEFAULT_CURRICULUM_FILE = path.resolve(
  process.cwd(),
  "data/training-academy/curriculum.v1.json"
);

const prisma = new PrismaClient();

function normalizeOptions(options) {
  if (Array.isArray(options)) {
    return options.map((option) => String(option));
  }
  if (options && typeof options === "object") {
    return Object.values(options).map((option) => String(option));
  }
  return [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = args.file || DEFAULT_CONTENT_FILE;

  const modules = await prisma.trainingModule.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      checkpoints: {
        orderBy: { sortOrder: "asc" },
      },
      quizQuestions: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const payload = {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    modules: modules.map((module) => ({
      contentKey:
        module.contentKey || fallbackKey("module", module.title, module.id),
      title: module.title,
      description: module.description,
      type: module.type,
      required: module.required,
      sortOrder: module.sortOrder,
      videoUrl: module.videoUrl,
      videoProvider: module.videoProvider,
      videoDuration: module.videoDuration,
      requiresQuiz: module.requiresQuiz,
      requiresEvidence: module.requiresEvidence,
      passScorePct: module.passScorePct,
      checkpoints: module.checkpoints.map((checkpoint) => ({
        contentKey:
          checkpoint.contentKey ||
          fallbackKey("checkpoint", checkpoint.title, checkpoint.id),
        title: checkpoint.title,
        description: checkpoint.description,
        required: checkpoint.required,
        sortOrder: checkpoint.sortOrder,
      })),
      quizQuestions: module.quizQuestions.map((question) => ({
        contentKey:
          question.contentKey ||
          fallbackKey("quiz", question.question, question.id),
        question: question.question,
        options: normalizeOptions(question.options),
        correctAnswer: question.correctAnswer,
        sortOrder: question.sortOrder,
        explanation: question.explanation,
      })),
    })),
  };

  const savedPath = writeJsonFile(outputPath, payload);
  console.log(`[training:export] Exported ${payload.modules.length} module(s) to ${savedPath}`);

  // ── Curriculum export (interactive journeys) ──────────────────────────────
  await exportCurriculumRegistry();
}

async function exportCurriculumRegistry() {
  // Fetch all INTERACTIVE_JOURNEY modules with their journeys and beats
  const modules = await prisma.trainingModule.findMany({
    where: { type: "INTERACTIVE_JOURNEY" },
    orderBy: { sortOrder: "asc" },
    include: {
      interactiveJourney: {
        include: {
          beats: {
            where: { removedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  const payload = {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    modules: modules
      .filter((m) => m.interactiveJourney !== null)
      .map((m) => {
        const journey = m.interactiveJourney;
        return {
          contentKey:
            m.contentKey || fallbackKey("module", m.title, m.id),
          module: {
            title: m.title,
            description: m.description,
            sortOrder: m.sortOrder,
            required: m.required,
            passScorePct: m.passScorePct,
          },
          journey: {
            estimatedMinutes: journey.estimatedMinutes,
            passScorePct: journey.passScorePct,
            strictMode: journey.strictMode,
            version: journey.version,
          },
          beats: journey.beats.map((beat) => ({
            id: beat.id,
            sourceKey: beat.sourceKey,
            sortOrder: beat.sortOrder,
            kind: beat.kind,
            title: beat.title,
            prompt: beat.prompt,
            mediaUrl: beat.mediaUrl,
            config: beat.config,
            schemaVersion: beat.schemaVersion,
            scoringWeight: beat.scoringWeight,
            scoringRule: beat.scoringRule,
            parentBeatId: beat.parentBeatId,
            showWhen: beat.showWhen,
          })),
        };
      }),
  };

  const curriculumPath = writeJsonFile(DEFAULT_CURRICULUM_FILE, payload);
  console.log(
    `[training:export] Exported ${payload.modules.length} interactive journey(s) to ${curriculumPath}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
