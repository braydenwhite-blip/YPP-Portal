"use server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  TrainingModuleType,
  TrainingStatus,
  VideoProvider,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

type TrainingContentCheckpoint = {
  contentKey: string;
  title: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
};

type TrainingContentQuizQuestion = {
  contentKey: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  sortOrder: number;
};

type TrainingContentModule = {
  contentKey: string;
  title: string;
  description: string;
  materialUrl: string | null;
  materialNotes: string | null;
  type: TrainingModuleType;
  required: boolean;
  sortOrder: number;
  videoUrl: string | null;
  videoProvider: VideoProvider | null;
  videoDuration: number | null;
  videoThumbnail: string | null;
  requiresQuiz: boolean;
  requiresEvidence: boolean;
  passScorePct: number;
  checkpoints: TrainingContentCheckpoint[];
  quizQuestions: TrainingContentQuizQuestion[];
};

export type TrainingContentPayload = {
  version: string;
  updatedAt: string;
  modules: TrainingContentModule[];
};

type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

type ImportCounters = {
  modulesCreated: number;
  modulesUpdated: number;
  modulesDeleted: number;
  checkpointsCreated: number;
  checkpointsUpdated: number;
  checkpointsDeleted: number;
  quizCreated: number;
  quizUpdated: number;
  quizDeleted: number;
  assignmentsCreated: number;
};

type LoadResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  content: TrainingContentPayload | null;
  rawJson: string;
};

type ImportResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counters: ImportCounters;
};

const TRACKABLE_REQUIRED_VIDEO_PROVIDERS = new Set<VideoProvider>([
  "YOUTUBE",
  "VIMEO",
  "CUSTOM",
]);

const VALID_MODULE_TYPES = new Set<string>(Object.values(TrainingModuleType));
const VALID_VIDEO_PROVIDERS = new Set<string>(Object.values(VideoProvider));

function createEmptyCounters(): ImportCounters {
  return {
    modulesCreated: 0,
    modulesUpdated: 0,
    modulesDeleted: 0,
    checkpointsCreated: 0,
    checkpointsUpdated: 0,
    checkpointsDeleted: 0,
    quizCreated: 0,
    quizUpdated: 0,
    quizDeleted: 0,
    assignmentsCreated: 0,
  };
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
  return session;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function fallbackKey(prefix: string, value: string, fallbackId: string) {
  const base = slugify(value || "item");
  const idPart = String(fallbackId || "na")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8);
  return `${prefix}_${base}_${idPart || "00000000"}`;
}

function normalizeOptions(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map((option) => String(option));
  }
  if (options && typeof options === "object") {
    return Object.values(options as Record<string, unknown>).map((option) =>
      String(option)
    );
  }
  return [];
}

function ensureArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pushError(errors: string[], pathLabel: string, message: string) {
  errors.push(`${pathLabel}: ${message}`);
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value.trim().length > 0 ? value.trim() : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null;
  return value;
}

function parseInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function validateAcademyContent(content: unknown): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || typeof content !== "object") {
    return {
      errors: ["Root: content must be an object"],
      warnings,
    };
  }

  const root = content as Record<string, unknown>;

  if (!parseString(root.version)) {
    pushError(errors, "version", "must be a string");
  }

  const updatedAt = parseString(root.updatedAt);
  if (!updatedAt || Number.isNaN(new Date(updatedAt).getTime())) {
    pushError(errors, "updatedAt", "must be a valid date string");
  }

  const modules = ensureArray(root.modules);
  if (modules.length === 0) {
    pushError(errors, "modules", "must include at least one module");
  }

  const moduleKeySet = new Set<string>();

  modules.forEach((moduleEntry, moduleIndex) => {
    const modulePath = `modules[${moduleIndex}]`;

    if (!moduleEntry || typeof moduleEntry !== "object") {
      pushError(errors, modulePath, "must be an object");
      return;
    }

    const module = moduleEntry as Record<string, unknown>;

    const moduleContentKey = parseString(module.contentKey);
    if (!moduleContentKey) {
      pushError(errors, `${modulePath}.contentKey`, "is required and must be a non-empty string");
    } else if (moduleKeySet.has(moduleContentKey)) {
      pushError(errors, `${modulePath}.contentKey`, `duplicate key: ${moduleContentKey}`);
    } else {
      moduleKeySet.add(moduleContentKey);
    }

    if (!parseString(module.title)) {
      pushError(errors, `${modulePath}.title`, "is required and must be a non-empty string");
    }
    if (!parseString(module.description)) {
      pushError(errors, `${modulePath}.description`, "is required and must be a non-empty string");
    }

    const moduleType = parseString(module.type);
    if (!moduleType || !VALID_MODULE_TYPES.has(moduleType)) {
      pushError(
        errors,
        `${modulePath}.type`,
        `must be one of ${Array.from(VALID_MODULE_TYPES).join(", ")}`
      );
    }

    const required = parseBoolean(module.required);
    if (required === null) {
      pushError(errors, `${modulePath}.required`, "must be a boolean");
    }

    const sortOrder = parseInteger(module.sortOrder);
    if (sortOrder === null || sortOrder < 1) {
      pushError(errors, `${modulePath}.sortOrder`, "must be an integer >= 1");
    }

    const passScore = parseInteger(module.passScorePct);
    if (passScore === null || passScore < 1 || passScore > 100) {
      pushError(errors, `${modulePath}.passScorePct`, "must be an integer between 1 and 100");
    }

    const videoUrl = parseOptionalString(module.videoUrl);
    const videoProvider = parseOptionalString(module.videoProvider);
    if (videoUrl && !videoProvider) {
      pushError(errors, `${modulePath}.videoProvider`, "is required when videoUrl is provided");
    }
    if (videoProvider && !VALID_VIDEO_PROVIDERS.has(videoProvider)) {
      pushError(
        errors,
        `${modulePath}.videoProvider`,
        `must be one of ${Array.from(VALID_VIDEO_PROVIDERS).join(", ")}`
      );
    }

    const requiresQuiz = parseBoolean(module.requiresQuiz);
    if (requiresQuiz === null) {
      pushError(errors, `${modulePath}.requiresQuiz`, "must be a boolean");
    }

    const requiresEvidence = parseBoolean(module.requiresEvidence);
    if (requiresEvidence === null) {
      pushError(errors, `${modulePath}.requiresEvidence`, "must be a boolean");
    }

    const checkpoints = ensureArray(module.checkpoints);
    const quizQuestions = ensureArray(module.quizQuestions);

    const checkpointKeySet = new Set<string>();
    const requiredCheckpointCount = checkpoints.filter((checkpointEntry) => {
      if (!checkpointEntry || typeof checkpointEntry !== "object") {
        return false;
      }
      const checkpoint = checkpointEntry as Record<string, unknown>;
      return checkpoint.required === true;
    }).length;

    checkpoints.forEach((checkpointEntry, checkpointIndex) => {
      const checkpointPath = `${modulePath}.checkpoints[${checkpointIndex}]`;
      if (!checkpointEntry || typeof checkpointEntry !== "object") {
        pushError(errors, checkpointPath, "must be an object");
        return;
      }

      const checkpoint = checkpointEntry as Record<string, unknown>;
      const checkpointContentKey = parseString(checkpoint.contentKey);
      if (!checkpointContentKey) {
        pushError(errors, `${checkpointPath}.contentKey`, "is required and must be a non-empty string");
      } else if (checkpointKeySet.has(checkpointContentKey)) {
        pushError(errors, `${checkpointPath}.contentKey`, `duplicate key in module: ${checkpointContentKey}`);
      } else {
        checkpointKeySet.add(checkpointContentKey);
      }

      if (!parseString(checkpoint.title)) {
        pushError(errors, `${checkpointPath}.title`, "is required and must be a non-empty string");
      }

      const checkpointRequired = parseBoolean(checkpoint.required);
      if (checkpointRequired === null) {
        pushError(errors, `${checkpointPath}.required`, "must be a boolean");
      }

      const checkpointSortOrder = parseInteger(checkpoint.sortOrder);
      if (checkpointSortOrder === null || checkpointSortOrder < 1) {
        pushError(errors, `${checkpointPath}.sortOrder`, "must be an integer >= 1");
      }

      const description = checkpoint.description;
      if (description !== null && description !== undefined && typeof description !== "string") {
        pushError(errors, `${checkpointPath}.description`, "must be a string when provided");
      }
    });

    const quizKeySet = new Set<string>();
    quizQuestions.forEach((quizEntry, quizIndex) => {
      const quizPath = `${modulePath}.quizQuestions[${quizIndex}]`;
      if (!quizEntry || typeof quizEntry !== "object") {
        pushError(errors, quizPath, "must be an object");
        return;
      }

      const quiz = quizEntry as Record<string, unknown>;
      const quizContentKey = parseString(quiz.contentKey);
      if (!quizContentKey) {
        pushError(errors, `${quizPath}.contentKey`, "is required and must be a non-empty string");
      } else if (quizKeySet.has(quizContentKey)) {
        pushError(errors, `${quizPath}.contentKey`, `duplicate key in module: ${quizContentKey}`);
      } else {
        quizKeySet.add(quizContentKey);
      }

      if (!parseString(quiz.question)) {
        pushError(errors, `${quizPath}.question`, "is required and must be a non-empty string");
      }

      const options = ensureArray(quiz.options)
        .map((option) => String(option).trim())
        .filter(Boolean);

      if (options.length < 2) {
        pushError(errors, `${quizPath}.options`, "must contain at least 2 options");
      }

      const correctAnswer = parseString(quiz.correctAnswer);
      if (!correctAnswer) {
        pushError(errors, `${quizPath}.correctAnswer`, "is required and must be a non-empty string");
      } else if (!options.includes(correctAnswer)) {
        pushError(errors, `${quizPath}.correctAnswer`, "must match one of the options exactly");
      }

      const quizSortOrder = parseInteger(quiz.sortOrder);
      if (quizSortOrder === null || quizSortOrder < 1) {
        pushError(errors, `${quizPath}.sortOrder`, "must be an integer >= 1");
      }

      const explanation = quiz.explanation;
      if (explanation !== null && explanation !== undefined && typeof explanation !== "string") {
        pushError(errors, `${quizPath}.explanation`, "must be a string when provided");
      }
    });

    const hasActionablePath =
      Boolean(videoUrl) ||
      requiredCheckpointCount > 0 ||
      requiresQuiz === true ||
      requiresEvidence === true;

    if (required === true && !hasActionablePath) {
      pushError(
        errors,
        modulePath,
        "required module must include video or required checkpoints or quiz or evidence"
      );
    }

    if (requiresQuiz === true && quizQuestions.length === 0) {
      pushError(errors, `${modulePath}.quizQuestions`, "requiresQuiz=true requires at least one quiz question");
    }

    if (
      required === true &&
      videoUrl &&
      videoProvider &&
      !TRACKABLE_REQUIRED_VIDEO_PROVIDERS.has(videoProvider as VideoProvider)
    ) {
      pushError(
        errors,
        `${modulePath}.videoProvider`,
        `must be one of ${Array.from(TRACKABLE_REQUIRED_VIDEO_PROVIDERS).join(", ")} for required modules`
      );
    }

    if (requiresQuiz === true && quizQuestions.length < 4) {
      warnings.push(`${modulePath}: quiz is enabled but has fewer than 4 questions`);
    }
    if (required === true && requiredCheckpointCount < 3) {
      warnings.push(`${modulePath}: required module has fewer than 3 required checkpoints`);
    }
  });

  return { errors, warnings };
}

function toPayload(content: unknown): TrainingContentPayload {
  const root = content as Record<string, unknown>;
  const modules = ensureArray(root.modules).map((moduleEntry) => {
    const module = moduleEntry as Record<string, unknown>;
    return {
      contentKey: String(module.contentKey),
      title: String(module.title),
      description: String(module.description),
      materialUrl: parseOptionalString(module.materialUrl),
      materialNotes: parseOptionalString(module.materialNotes),
      type: String(module.type) as TrainingModuleType,
      required: Boolean(module.required),
      sortOrder: Number(module.sortOrder),
      videoUrl: parseOptionalString(module.videoUrl),
      videoProvider: parseOptionalString(module.videoProvider) as VideoProvider | null,
      videoDuration:
        module.videoDuration === null || module.videoDuration === undefined
          ? null
          : Number(module.videoDuration),
      videoThumbnail: parseOptionalString(module.videoThumbnail),
      requiresQuiz: Boolean(module.requiresQuiz),
      requiresEvidence: Boolean(module.requiresEvidence),
      passScorePct: Number(module.passScorePct),
      checkpoints: ensureArray(module.checkpoints).map((checkpointEntry) => {
        const checkpoint = checkpointEntry as Record<string, unknown>;
        return {
          contentKey: String(checkpoint.contentKey),
          title: String(checkpoint.title),
          description: parseOptionalString(checkpoint.description),
          required: Boolean(checkpoint.required),
          sortOrder: Number(checkpoint.sortOrder),
        };
      }),
      quizQuestions: ensureArray(module.quizQuestions).map((quizEntry) => {
        const quiz = quizEntry as Record<string, unknown>;
        return {
          contentKey: String(quiz.contentKey),
          question: String(quiz.question),
          options: ensureArray(quiz.options).map((option) => String(option)),
          correctAnswer: String(quiz.correctAnswer),
          explanation: parseOptionalString(quiz.explanation),
          sortOrder: Number(quiz.sortOrder),
        };
      }),
    };
  });

  return {
    version: String(root.version),
    updatedAt: String(root.updatedAt),
    modules,
  };
}

function parseAndValidateDraft(rawJson: string): {
  payload: TrainingContentPayload | null;
  errors: string[];
  warnings: string[];
} {
  if (!rawJson || rawJson.trim().length === 0) {
    return {
      payload: null,
      errors: ["Root: raw JSON content is required"],
      warnings: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      payload: null,
      errors: ["Root: invalid JSON format"],
      warnings: [],
    };
  }

  const { errors, warnings } = validateAcademyContent(parsed);
  if (errors.length > 0) {
    return { payload: null, errors, warnings };
  }

  return {
    payload: toPayload(parsed),
    errors: [],
    warnings,
  };
}

async function buildContentFromDb(): Promise<TrainingContentPayload> {
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

  return {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    modules: modules.map((module) => ({
      contentKey:
        module.contentKey || fallbackKey("module", module.title, module.id),
      title: module.title,
      description: module.description,
      materialUrl: module.materialUrl,
      materialNotes: module.materialNotes,
      type: module.type,
      required: module.required,
      sortOrder: module.sortOrder,
      videoUrl: module.videoUrl,
      videoProvider: module.videoProvider,
      videoDuration: module.videoDuration,
      videoThumbnail: module.videoThumbnail,
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
        explanation: question.explanation,
        sortOrder: question.sortOrder,
      })),
    })),
  };
}

async function upsertModule(
  definition: TrainingContentModule,
  counters: ImportCounters
) {
  const existing = await prisma.trainingModule.findFirst({
    where: {
      OR: [{ contentKey: definition.contentKey }, { title: definition.title }],
    },
    select: {
      id: true,
    },
  });

  const data = {
    contentKey: definition.contentKey,
    title: definition.title,
    description: definition.description,
    materialUrl: definition.materialUrl || null,
    materialNotes: definition.materialNotes || null,
    type: definition.type,
    required: definition.required,
    sortOrder: definition.sortOrder,
    videoUrl: definition.videoUrl || null,
    videoProvider: definition.videoProvider || null,
    videoDuration:
      definition.videoDuration === null || definition.videoDuration === undefined
        ? null
        : Number(definition.videoDuration),
    videoThumbnail: definition.videoThumbnail || null,
    requiresQuiz: definition.requiresQuiz,
    requiresEvidence: definition.requiresEvidence,
    passScorePct: definition.passScorePct,
  };

  if (!existing) {
    counters.modulesCreated += 1;
    const created = await prisma.trainingModule.create({
      data,
      select: { id: true },
    });
    return created.id;
  }

  counters.modulesUpdated += 1;
  await prisma.trainingModule.update({
    where: { id: existing.id },
    data,
  });
  return existing.id;
}

async function upsertCheckpoint(
  moduleId: string,
  checkpoint: TrainingContentCheckpoint,
  counters: ImportCounters
) {
  const existing = await prisma.trainingCheckpoint.findFirst({
    where: {
      moduleId,
      OR: [{ contentKey: checkpoint.contentKey }, { title: checkpoint.title }],
    },
    select: { id: true },
  });

  const data = {
    contentKey: checkpoint.contentKey,
    title: checkpoint.title,
    description: checkpoint.description || null,
    required: checkpoint.required,
    sortOrder: checkpoint.sortOrder,
  };

  if (!existing) {
    counters.checkpointsCreated += 1;
    await prisma.trainingCheckpoint.create({
      data: {
        moduleId,
        ...data,
      },
    });
    return;
  }

  counters.checkpointsUpdated += 1;
  await prisma.trainingCheckpoint.update({
    where: { id: existing.id },
    data,
  });
}

async function upsertQuizQuestion(
  moduleId: string,
  question: TrainingContentQuizQuestion,
  counters: ImportCounters
) {
  const existing = await prisma.trainingQuizQuestion.findFirst({
    where: {
      moduleId,
      OR: [{ contentKey: question.contentKey }, { question: question.question }],
    },
    select: { id: true },
  });

  const data = {
    contentKey: question.contentKey,
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation || null,
    sortOrder: question.sortOrder,
  };

  if (!existing) {
    counters.quizCreated += 1;
    await prisma.trainingQuizQuestion.create({
      data: {
        moduleId,
        ...data,
      },
    });
    return;
  }

  counters.quizUpdated += 1;
  await prisma.trainingQuizQuestion.update({
    where: { id: existing.id },
    data,
  });
}

async function pruneModuleChildren(
  moduleId: string,
  checkpointKeys: string[],
  questionKeys: string[],
  counters: ImportCounters
) {
  const checkpointDeleteResult = await prisma.trainingCheckpoint.deleteMany({
    where: {
      moduleId,
      contentKey: { not: null, notIn: checkpointKeys },
    },
  });
  const questionDeleteResult = await prisma.trainingQuizQuestion.deleteMany({
    where: {
      moduleId,
      contentKey: { not: null, notIn: questionKeys },
    },
  });

  counters.checkpointsDeleted += checkpointDeleteResult.count;
  counters.quizDeleted += questionDeleteResult.count;
}

async function pruneModules(importedModuleKeys: string[], counters: ImportCounters) {
  const deleteResult = await prisma.trainingModule.deleteMany({
    where: {
      contentKey: {
        not: null,
        notIn: importedModuleKeys,
      },
    },
  });
  counters.modulesDeleted += deleteResult.count;
}

async function syncAssignmentsForRequiredModules(
  requiredModuleIds: string[],
  counters: ImportCounters
) {
  if (requiredModuleIds.length === 0) return;

  const instructors = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: "INSTRUCTOR",
        },
      },
    },
    select: { id: true },
  });

  const assignmentData: {
    userId: string;
    moduleId: string;
    status: TrainingStatus;
  }[] = [];
  for (const instructor of instructors) {
    for (const moduleId of requiredModuleIds) {
      assignmentData.push({
        userId: instructor.id,
        moduleId,
        status: TrainingStatus.NOT_STARTED,
      });
    }
  }

  if (assignmentData.length === 0) return;

  const result = await prisma.trainingAssignment.createMany({
    data: assignmentData,
    skipDuplicates: true,
  });
  counters.assignmentsCreated += result.count;
}

export async function loadTrainingContentFromDb(): Promise<LoadResult> {
  await requireAdmin();

  try {
    const content = await buildContentFromDb();
    return {
      ok: true,
      errors: [],
      warnings: [],
      content,
      rawJson: `${JSON.stringify(content, null, 2)}\n`,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "Unable to load training content"],
      warnings: [],
      content: null,
      rawJson: "",
    };
  }
}

export async function validateTrainingContentDraft(
  rawJson: string
): Promise<ValidationResult> {
  await requireAdmin();
  const { errors, warnings } = parseAndValidateDraft(rawJson);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export async function importTrainingContentDraft(
  rawJson: string,
  prune: boolean
): Promise<ImportResult> {
  await requireAdmin();

  const parsed = parseAndValidateDraft(rawJson);
  if (!parsed.payload) {
    return {
      ok: false,
      errors: parsed.errors,
      warnings: parsed.warnings,
      counters: createEmptyCounters(),
    };
  }

  const counters = createEmptyCounters();

  try {
    const importedModuleKeys: string[] = [];
    const requiredModuleIds: string[] = [];

    for (const moduleDefinition of parsed.payload.modules) {
      importedModuleKeys.push(moduleDefinition.contentKey);
      const moduleId = await upsertModule(moduleDefinition, counters);

      if (moduleDefinition.required) {
        requiredModuleIds.push(moduleId);
      }

      const checkpointKeys: string[] = [];
      for (const checkpoint of moduleDefinition.checkpoints) {
        checkpointKeys.push(checkpoint.contentKey);
        await upsertCheckpoint(moduleId, checkpoint, counters);
      }

      const questionKeys: string[] = [];
      for (const question of moduleDefinition.quizQuestions) {
        questionKeys.push(question.contentKey);
        await upsertQuizQuestion(moduleId, question, counters);
      }

      if (prune) {
        await pruneModuleChildren(moduleId, checkpointKeys, questionKeys, counters);
      }
    }

    if (prune) {
      await pruneModules(importedModuleKeys, counters);
    }

    await syncAssignmentsForRequiredModules(requiredModuleIds, counters);

    revalidatePath("/admin/training");
    revalidatePath("/instructor-training");
    revalidatePath("/student-training");
    revalidatePath("/instructor/training-progress");

    return {
      ok: true,
      errors: [],
      warnings: parsed.warnings,
      counters,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "Training content import failed"],
      warnings: parsed.warnings,
      counters,
    };
  }
}

export async function exportTrainingContentDraft(): Promise<LoadResult> {
  return loadTrainingContentFromDb();
}
