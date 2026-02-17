import { PrismaClient, PassionCategory } from "@prisma/client";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

const PASSION_SEEDS = [
  {
    name: "Coding",
    category: PassionCategory.STEM,
    description: "Software, apps, game design, and computational thinking.",
    icon: "💻",
    color: "#2563eb",
    order: 1,
  },
  {
    name: "Music",
    category: PassionCategory.MUSIC,
    description: "Performance, songwriting, production, and composition.",
    icon: "🎵",
    color: "#16a34a",
    order: 2,
  },
  {
    name: "Writing",
    category: PassionCategory.WRITING,
    description: "Storytelling, journalism, poetry, and authoring.",
    icon: "✍️",
    color: "#d97706",
    order: 3,
  },
  {
    name: "Design",
    category: PassionCategory.ARTS,
    description: "Visual design, product design, and creative communication.",
    icon: "🎨",
    color: "#db2777",
    order: 4,
  },
];

const ALIASES = {
  Coding: ["coding", "code", "programming", "software", "web dev", "web development"],
  Music: ["music", "songwriting", "production", "singing", "instrument"],
  Writing: ["writing", "writer", "journalism", "poetry", "storytelling"],
  Design: ["design", "graphic design", "product design", "art", "creative"],
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function unique(values) {
  return Array.from(new Set(values));
}

function isMissingTableError(error) {
  return Boolean(error && typeof error === "object" && error.code === "P2021");
}

function createEmptyResult(label) {
  return {
    label,
    skipped: false,
    scanned: 0,
    updated: 0,
    unmatched: 0,
    unmatchedSamples: [],
  };
}

async function upsertPassionAreas() {
  for (const passion of PASSION_SEEDS) {
    if (isDryRun) continue;
    await prisma.passionArea.upsert({
      where: { name: passion.name },
      update: {
        category: passion.category,
        description: passion.description,
        icon: passion.icon,
        color: passion.color,
        order: passion.order,
        isActive: true,
      },
      create: {
        ...passion,
        relatedAreaIds: [],
        isActive: true,
      },
    });
  }
}

async function buildResolver() {
  const areas = await prisma.passionArea.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true, order: true },
    orderBy: [{ category: "asc" }, { order: "asc" }, { name: "asc" }],
  });

  const idByToken = new Map();
  const firstIdByCategory = new Map();

  for (const area of areas) {
    idByToken.set(normalize(area.id), area.id);
    idByToken.set(normalize(area.name), area.id);
    if (!firstIdByCategory.has(area.category)) {
      firstIdByCategory.set(area.category, area.id);
      idByToken.set(normalize(area.category), area.id);
    }
  }

  for (const [canonicalName, aliases] of Object.entries(ALIASES)) {
    const canonicalId = idByToken.get(normalize(canonicalName));
    if (!canonicalId) continue;
    for (const alias of aliases) {
      idByToken.set(normalize(alias), canonicalId);
    }
  }

  return {
    areas,
    resolve(value) {
      const token = normalize(value);
      if (!token) return null;
      return idByToken.get(token) || null;
    },
  };
}

function recordUnmatched(result, model, id, rawValue) {
  result.unmatched += 1;
  if (result.unmatchedSamples.length < 25) {
    result.unmatchedSamples.push({ model, id, rawValue });
  }
}

async function normalizeStringField({
  result,
  model,
  rows,
  readValue,
  update,
  resolver,
}) {
  result.scanned += rows.length;
  for (const row of rows) {
    const raw = readValue(row);
    if (!raw) continue;

    const canonicalId = resolver.resolve(raw);
    if (!canonicalId) {
      recordUnmatched(result, model, row.id, raw);
      continue;
    }

    if (canonicalId === raw) continue;

    if (!isDryRun) {
      await update(row.id, canonicalId);
    }
    result.updated += 1;
  }
}

async function normalizeArrayField({
  result,
  model,
  rows,
  readValues,
  update,
  resolver,
}) {
  result.scanned += rows.length;
  for (const row of rows) {
    const rawValues = readValues(row);
    if (!Array.isArray(rawValues) || rawValues.length === 0) continue;

    let changed = false;
    const mapped = [];

    for (const raw of rawValues) {
      if (!raw) continue;
      const canonicalId = resolver.resolve(raw);
      if (!canonicalId) {
        recordUnmatched(result, model, row.id, raw);
        mapped.push(raw);
        continue;
      }
      if (canonicalId !== raw) changed = true;
      mapped.push(canonicalId);
    }

    const deduped = unique(mapped.filter(Boolean));
    if (!changed && deduped.length === rawValues.length) continue;

    if (!isDryRun) {
      await update(row.id, deduped);
    }
    result.updated += 1;
  }
}

async function runWithMissingTableGuard(label, fn) {
  const result = createEmptyResult(label);
  try {
    await fn(result);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    result.skipped = true;
  }
  return result;
}

async function normalizeChallengePassionArea(resolver) {
  return runWithMissingTableGuard("challenge.passionArea", async (result) => {
    const rows = await prisma.challenge.findMany({
      where: { passionArea: { not: null } },
      select: { id: true, passionArea: true },
    });

    await normalizeStringField({
      result,
      model: "Challenge",
      rows,
      readValue: (row) => row.passionArea,
      resolver,
      update: (id, passionId) =>
        prisma.challenge.update({
          where: { id },
          data: { passionArea: passionId },
        }),
    });
  });
}

async function normalizeIncubatorProjectPassionArea(resolver) {
  return runWithMissingTableGuard("incubatorProject.passionArea", async (result) => {
    const rows = await prisma.incubatorProject.findMany({
      select: { id: true, passionArea: true },
    });

    await normalizeStringField({
      result,
      model: "IncubatorProject",
      rows,
      readValue: (row) => row.passionArea,
      resolver,
      update: (id, passionId) =>
        prisma.incubatorProject.update({
          where: { id },
          data: { passionArea: passionId },
        }),
    });
  });
}

async function normalizeIncubatorApplicationPassionArea(resolver) {
  return runWithMissingTableGuard("incubatorApplication.passionArea", async (result) => {
    const rows = await prisma.incubatorApplication.findMany({
      select: { id: true, passionArea: true },
    });

    await normalizeStringField({
      result,
      model: "IncubatorApplication",
      rows,
      readValue: (row) => row.passionArea,
      resolver,
      update: (id, passionId) =>
        prisma.incubatorApplication.update({
          where: { id },
          data: { passionArea: passionId },
        }),
    });
  });
}

async function normalizeIncubatorCohortPassionAreas(resolver) {
  return runWithMissingTableGuard("incubatorCohort.passionAreas", async (result) => {
    const rows = await prisma.incubatorCohort.findMany({
      select: { id: true, passionAreas: true },
    });

    await normalizeArrayField({
      result,
      model: "IncubatorCohort",
      rows,
      readValues: (row) => row.passionAreas,
      resolver,
      update: (id, passionAreas) =>
        prisma.incubatorCohort.update({
          where: { id },
          data: { passionAreas },
        }),
    });
  });
}

async function normalizeProjectTrackerPassionId(resolver) {
  return runWithMissingTableGuard("projectTracker.passionId", async (result) => {
    const rows = await prisma.projectTracker.findMany({
      select: { id: true, passionId: true },
    });

    await normalizeStringField({
      result,
      model: "ProjectTracker",
      rows,
      readValue: (row) => row.passionId,
      resolver,
      update: (id, passionId) =>
        prisma.projectTracker.update({
          where: { id },
          data: { passionId },
        }),
    });
  });
}

async function normalizeTryItSessionPassionId(resolver) {
  return runWithMissingTableGuard("tryItSession.passionId", async (result) => {
    const rows = await prisma.tryItSession.findMany({
      select: { id: true, passionId: true },
    });

    await normalizeStringField({
      result,
      model: "TryItSession",
      rows,
      readValue: (row) => row.passionId,
      resolver,
      update: (id, passionId) =>
        prisma.tryItSession.update({
          where: { id },
          data: { passionId },
        }),
    });
  });
}

async function normalizeTalentChallengePassionIds(resolver) {
  return runWithMissingTableGuard("talentChallenge.passionIds", async (result) => {
    const rows = await prisma.talentChallenge.findMany({
      select: { id: true, passionIds: true },
    });

    await normalizeArrayField({
      result,
      model: "TalentChallenge",
      rows,
      readValues: (row) => row.passionIds,
      resolver,
      update: (id, passionIds) =>
        prisma.talentChallenge.update({
          where: { id },
          data: { passionIds },
        }),
    });
  });
}

function printResult(result) {
  const prefix = result.skipped ? "SKIPPED" : isDryRun ? "DRY-RUN" : "UPDATED";
  console.log(
    `[${prefix}] ${result.label}: scanned=${result.scanned}, updated=${result.updated}, unmatched=${result.unmatched}`
  );
}

function printMismatchReport(results) {
  const mismatches = results.flatMap((result) =>
    result.unmatchedSamples.map((sample) => ({ ...sample, label: result.label }))
  );

  if (mismatches.length === 0) {
    console.log("No taxonomy mismatches found.");
    return;
  }

  console.log("Mismatch samples (up to 25 total):");
  for (const mismatch of mismatches.slice(0, 25)) {
    console.log(
      `- ${mismatch.label} | ${mismatch.model}(${mismatch.id}) -> '${mismatch.rawValue}'`
    );
  }
}

async function main() {
  await upsertPassionAreas();
  const resolver = await buildResolver();

  const results = await Promise.all([
    normalizeChallengePassionArea(resolver),
    normalizeIncubatorProjectPassionArea(resolver),
    normalizeIncubatorApplicationPassionArea(resolver),
    normalizeIncubatorCohortPassionAreas(resolver),
    normalizeProjectTrackerPassionId(resolver),
    normalizeTryItSessionPassionId(resolver),
    normalizeTalentChallengePassionIds(resolver),
  ]);

  console.log(
    `Passion taxonomy backfill complete (${isDryRun ? "dry-run" : "write"} mode). Active passions: ${resolver.areas.length}`
  );
  for (const result of results) {
    printResult(result);
  }
  printMismatchReport(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
