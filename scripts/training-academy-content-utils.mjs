import fs from "node:fs";
import path from "node:path";

export const DEFAULT_CONTENT_FILE = path.resolve(
  process.cwd(),
  "data/training-academy/content.v1.json"
);

export const TRACKABLE_REQUIRED_VIDEO_PROVIDERS = new Set([
  "YOUTUBE",
  "VIMEO",
  "CUSTOM",
]);

export function parseArgs(argv) {
  const args = {
    file: DEFAULT_CONTENT_FILE,
    dryRun: false,
    prune: false,
  };

  for (const token of argv) {
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--prune") {
      args.prune = true;
      continue;
    }
    if (token.startsWith("--prune=")) {
      const raw = token.split("=", 2)[1]?.trim().toLowerCase();
      args.prune = raw === "true" || raw === "1" || raw === "yes";
      continue;
    }
    if (token.startsWith("--file=")) {
      const raw = token.split("=", 2)[1]?.trim();
      if (raw) {
        args.file = path.resolve(process.cwd(), raw);
      }
    }
  }

  return args;
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function fallbackKey(prefix, value, fallbackId) {
  const base = slugify(value || "item");
  const idPart = String(fallbackId || "na").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `${prefix}_${base}_${idPart || "00000000"}`;
}

export function readAcademyContent(filePath) {
  const absolutePath = path.resolve(filePath || DEFAULT_CONTENT_FILE);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Content file not found: ${absolutePath}`);
  }

  let content;
  try {
    const raw = fs.readFileSync(absolutePath, "utf8");
    content = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse content file JSON: ${absolutePath}`);
  }

  return {
    absolutePath,
    content,
  };
}

function pushError(errors, pathLabel, message) {
  errors.push(`${pathLabel}: ${message}`);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function validateAcademyContent(content) {
  const errors = [];
  const warnings = [];

  if (!content || typeof content !== "object") {
    return {
      errors: ["Root: content must be an object"],
      warnings,
    };
  }

  if (!content.version || typeof content.version !== "string") {
    pushError(errors, "version", "must be a string");
  }

  if (!content.updatedAt || Number.isNaN(new Date(content.updatedAt).getTime())) {
    pushError(errors, "updatedAt", "must be a valid date string");
  }

  const modules = ensureArray(content.modules);
  if (modules.length === 0) {
    pushError(errors, "modules", "must include at least one module");
  }

  const moduleKeySet = new Set();

  modules.forEach((module, moduleIndex) => {
    const modulePath = `modules[${moduleIndex}]`;

    if (!module || typeof module !== "object") {
      pushError(errors, modulePath, "must be an object");
      return;
    }

    if (!module.contentKey || typeof module.contentKey !== "string") {
      pushError(errors, `${modulePath}.contentKey`, "is required and must be a string");
    } else if (moduleKeySet.has(module.contentKey)) {
      pushError(errors, `${modulePath}.contentKey`, `duplicate key: ${module.contentKey}`);
    } else {
      moduleKeySet.add(module.contentKey);
    }

    if (!module.title || typeof module.title !== "string") {
      pushError(errors, `${modulePath}.title`, "is required and must be a string");
    }

    if (!module.description || typeof module.description !== "string") {
      pushError(errors, `${modulePath}.description`, "is required and must be a string");
    }

    const passScore = Number(module.passScorePct);
    if (!Number.isFinite(passScore) || passScore < 1 || passScore > 100) {
      pushError(errors, `${modulePath}.passScorePct`, "must be a number between 1 and 100");
    }

    const checkpoints = ensureArray(module.checkpoints);
    const quizQuestions = ensureArray(module.quizQuestions);

    const requiredCheckpointCount = checkpoints.filter((checkpoint) => checkpoint?.required === true).length;
    const hasVideo = Boolean(module.videoUrl);
    const hasActionablePath =
      hasVideo ||
      requiredCheckpointCount > 0 ||
      module.requiresQuiz === true ||
      module.requiresEvidence === true;

    if (module.required === true && !hasActionablePath) {
      pushError(
        errors,
        modulePath,
        "required module must include video or required checkpoints or quiz or evidence"
      );
    }

    if (module.requiresQuiz === true && quizQuestions.length === 0) {
      pushError(errors, `${modulePath}.quizQuestions`, "requiresQuiz=true requires at least one quiz question");
    }

    if (hasVideo && !module.videoProvider) {
      pushError(errors, `${modulePath}.videoProvider`, "is required when videoUrl is provided");
    }

    if (
      module.required === true &&
      hasVideo &&
      module.videoProvider &&
      !TRACKABLE_REQUIRED_VIDEO_PROVIDERS.has(module.videoProvider)
    ) {
      pushError(
        errors,
        `${modulePath}.videoProvider`,
        `must be one of ${Array.from(TRACKABLE_REQUIRED_VIDEO_PROVIDERS).join(", ")} for required modules`
      );
    }

    const checkpointKeySet = new Set();
    checkpoints.forEach((checkpoint, checkpointIndex) => {
      const checkpointPath = `${modulePath}.checkpoints[${checkpointIndex}]`;
      if (!checkpoint?.contentKey || typeof checkpoint.contentKey !== "string") {
        pushError(errors, `${checkpointPath}.contentKey`, "is required and must be a string");
      } else if (checkpointKeySet.has(checkpoint.contentKey)) {
        pushError(errors, `${checkpointPath}.contentKey`, `duplicate key in module: ${checkpoint.contentKey}`);
      } else {
        checkpointKeySet.add(checkpoint.contentKey);
      }

      if (!checkpoint?.title || typeof checkpoint.title !== "string") {
        pushError(errors, `${checkpointPath}.title`, "is required and must be a string");
      }

      const sortOrder = Number(checkpoint?.sortOrder);
      if (!Number.isFinite(sortOrder) || sortOrder < 1) {
        pushError(errors, `${checkpointPath}.sortOrder`, "must be a number >= 1");
      }
    });

    const quizKeySet = new Set();
    quizQuestions.forEach((question, questionIndex) => {
      const quizPath = `${modulePath}.quizQuestions[${questionIndex}]`;

      if (!question?.contentKey || typeof question.contentKey !== "string") {
        pushError(errors, `${quizPath}.contentKey`, "is required and must be a string");
      } else if (quizKeySet.has(question.contentKey)) {
        pushError(errors, `${quizPath}.contentKey`, `duplicate key in module: ${question.contentKey}`);
      } else {
        quizKeySet.add(question.contentKey);
      }

      if (!question?.question || typeof question.question !== "string") {
        pushError(errors, `${quizPath}.question`, "is required and must be a string");
      }

      const options = ensureArray(question?.options).map((option) => String(option).trim()).filter(Boolean);
      if (options.length < 2) {
        pushError(errors, `${quizPath}.options`, "must contain at least 2 options");
      }

      if (!options.includes(String(question?.correctAnswer || ""))) {
        pushError(errors, `${quizPath}.correctAnswer`, "must match one of the options exactly");
      }

      const sortOrder = Number(question?.sortOrder);
      if (!Number.isFinite(sortOrder) || sortOrder < 1) {
        pushError(errors, `${quizPath}.sortOrder`, "must be a number >= 1");
      }
    });

    if (module.requiresQuiz === true && quizQuestions.length < 4) {
      warnings.push(`${modulePath}: quiz is enabled but has fewer than 4 questions`);
    }
    if (module.required === true && requiredCheckpointCount < 3) {
      warnings.push(`${modulePath}: required module has fewer than 3 required checkpoints`);
    }
  });

  return { errors, warnings };
}

export function writeJsonFile(filePath, value) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return absolutePath;
}

// ---------------------------------------------------------------------------
// Curriculum registry loader
// ---------------------------------------------------------------------------
//
// These helpers dynamic-import TypeScript source files. The scripts that use
// them are invoked via `tsx` (see `training:validate` / `training:import` /
// `training:export` in package.json) so the TS loader handles all TS
// resolution transparently — no manual `tsImport` call is needed here.

/**
 * Dynamic-import the TypeScript curriculum registry. Assumes this module is
 * being executed by tsx (so .ts extensions resolve automatically).
 * Returns `{ list: CurriculumDefinition[], byKey: Map<string, CurriculumDefinition> }`.
 */
export async function loadCurriculumRegistry() {
  const mod = await import("../lib/training-curriculum/index.ts");
  const list = mod.listCurricula();
  const byKey = new Map(list.map((c) => [c.contentKey, c]));
  return { list, byKey };
}

/**
 * Dynamic-import the beat config/schema registries. Assumes tsx interpreter.
 * Returns `{ beatConfigSchemas, beatSchemaVersions }`.
 */
export async function loadBeatSchemas() {
  const mod = await import("../lib/training-journey/schemas.ts");
  return {
    beatConfigSchemas: mod.BEAT_CONFIG_SCHEMAS,
    beatSchemaVersions: mod.BEAT_SCHEMA_VERSIONS,
  };
}

// ---------------------------------------------------------------------------
// Curriculum registry validator
// ---------------------------------------------------------------------------

/**
 * Validate all curricula in the registry against the rules defined in the
 * Phase 3 spec.
 *
 * @param {import("../lib/training-curriculum/types").CurriculumDefinition[]} list
 * @param {{ beatConfigSchemas: Record<string, import("zod").ZodTypeAny> }} options
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateCurriculumRegistry(list, { beatConfigSchemas }) {
  const errors = [];
  const warnings = [];

  // contentKey uniqueness across all modules
  const globalContentKeys = new Set();

  for (const curriculum of list) {
    const { contentKey, module: mod, journey, beats } = curriculum;
    const prefix = `curriculum[${contentKey}]`;

    if (globalContentKeys.has(contentKey)) {
      errors.push(`${prefix}: duplicate contentKey across registry`);
    } else {
      globalContentKeys.add(contentKey);
    }

    // Flatten beats (DFS) to validate the flat list
    const flatBeats = flattenBeatsForValidation(beats, null);

    // sourceKey uniqueness within journey
    const sourceKeySet = new Set();
    for (const beat of flatBeats) {
      if (sourceKeySet.has(beat.sourceKey)) {
        errors.push(
          `${prefix} beat[${beat.sourceKey}]: duplicate sourceKey within journey`
        );
      } else {
        sourceKeySet.add(beat.sourceKey);
      }
    }

    // sortOrder contiguous 1..N for top-level beats
    const topLevelBeats = beats.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < topLevelBeats.length; i++) {
      const expected = i + 1;
      if (topLevelBeats[i].sortOrder !== expected) {
        errors.push(
          `${prefix}: top-level beat sortOrders must be contiguous 1..N; beat[${topLevelBeats[i].sourceKey}] has sortOrder=${topLevelBeats[i].sortOrder}, expected ${expected}`
        );
        break; // report first gap only
      }
    }

    // Validate each beat
    for (const beat of flatBeats) {
      const beatPrefix = `${prefix} beat[${beat.sourceKey}]`;

      // prompt ≤ 280 chars
      if (typeof beat.prompt === "string" && beat.prompt.length > 280) {
        errors.push(`${beatPrefix}: prompt exceeds 280 characters (${beat.prompt.length})`);
      }

      // config validates against Zod schema
      const schema = beatConfigSchemas[beat.kind];
      if (!schema) {
        errors.push(`${beatPrefix}: unknown beat kind "${beat.kind}"`);
      } else {
        const result = schema.safeParse(beat.config);
        if (!result.success) {
          errors.push(
            `${beatPrefix}: config validation failed: ${result.error.message}`
          );
        }
      }

      // Scored beats must have correctFeedback and incorrectFeedback.default
      if (beat.scoringWeight > 0) {
        const cfg = beat.config;
        if (!cfg || typeof cfg !== "object") continue;
        if (!("correctFeedback" in cfg)) {
          errors.push(`${beatPrefix}: scoringWeight>0 but config.correctFeedback is missing`);
        }
        if (!("incorrectFeedback" in cfg) || !cfg.incorrectFeedback?.default) {
          errors.push(
            `${beatPrefix}: scoringWeight>0 but config.incorrectFeedback.default is missing`
          );
        }
      }
    }

    // Journey-level rules (operate on top-level flat ordered beats)
    // For these rules we use the flat list sorted by sortOrder
    const orderedFlat = flatBeats
      .filter((b) => !b.parentSourceKey) // top-level only for sequential checks
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // No journey has more than 1 CONCEPT_REVEAL per 4 total beats
    const totalTopLevel = orderedFlat.length;
    const conceptRevealCount = orderedFlat.filter(
      (b) => b.kind === "CONCEPT_REVEAL"
    ).length;
    const maxConceptReveals = Math.floor(totalTopLevel / 4);
    if (conceptRevealCount > maxConceptReveals && totalTopLevel >= 4) {
      errors.push(
        `${prefix}: ${conceptRevealCount} CONCEPT_REVEAL beat(s) exceeds limit of 1 per 4 beats (max=${maxConceptReveals} for ${totalTopLevel} beats)`
      );
    }

    // No more than 2 consecutive unscored beats
    let consecutiveUnscored = 0;
    for (const beat of orderedFlat) {
      if (beat.scoringWeight === 0) {
        consecutiveUnscored += 1;
        if (consecutiveUnscored > 2) {
          errors.push(
            `${prefix} beat[${beat.sourceKey}]: more than 2 consecutive unscored beats (scoringWeight=0)`
          );
          break;
        }
      } else {
        consecutiveUnscored = 0;
      }
    }

    // At least one scored beat in the first half
    const halfCount = Math.ceil(orderedFlat.length / 2);
    const firstHalf = orderedFlat.slice(0, halfCount);
    const firstHalfHasScored = firstHalf.some((b) => b.scoringWeight > 0);
    if (!firstHalfHasScored && orderedFlat.length > 0) {
      errors.push(
        `${prefix}: no scored beat (scoringWeight>0) in the first half of the journey`
      );
    }
  }

  return { errors, warnings };
}

/**
 * Flatten the beat tree for validation (same DFS as import, but lightweight).
 * @param {import("../lib/training-curriculum/types").BeatDefinition[]} beats
 * @param {string | null} parentSourceKey
 */
function flattenBeatsForValidation(beats, parentSourceKey) {
  const result = [];
  for (const beat of beats) {
    result.push({ ...beat, parentSourceKey: beat.parentSourceKey ?? parentSourceKey });
    if (beat.children && beat.children.length > 0) {
      result.push(...flattenBeatsForValidation(beat.children, beat.sourceKey));
    }
  }
  return result;
}
