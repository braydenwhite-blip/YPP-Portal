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
