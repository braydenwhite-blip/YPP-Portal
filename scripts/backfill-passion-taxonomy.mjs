import { PrismaClient, PassionCategory } from "@prisma/client";

const prisma = new PrismaClient();

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

function canonicalNameFromValue(value) {
  const normalized = normalize(value);
  for (const [name, aliasList] of Object.entries(ALIASES)) {
    if (aliasList.includes(normalized)) {
      return name;
    }
  }
  return null;
}

async function upsertPassionAreas() {
  for (const passion of PASSION_SEEDS) {
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

async function normalizeChallengePassionArea() {
  const challenges = await prisma.challenge.findMany({
    where: { passionArea: { not: null } },
    select: { id: true, passionArea: true },
  });

  let updated = 0;
  for (const challenge of challenges) {
    const canonical = canonicalNameFromValue(challenge.passionArea);
    if (!canonical || canonical === challenge.passionArea) continue;

    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { passionArea: canonical },
    });
    updated += 1;
  }
  return { scanned: challenges.length, updated };
}

async function normalizeIncubatorPassionArea() {
  const projects = await prisma.incubatorProject.findMany({
    select: { id: true, passionArea: true },
  });

  let updated = 0;
  for (const project of projects) {
    const canonical = canonicalNameFromValue(project.passionArea);
    if (!canonical || canonical === project.passionArea) continue;

    await prisma.incubatorProject.update({
      where: { id: project.id },
      data: { passionArea: canonical },
    });
    updated += 1;
  }
  return { scanned: projects.length, updated };
}

async function main() {
  await upsertPassionAreas();
  const challengeResult = await normalizeChallengePassionArea();
  const incubatorResult = await normalizeIncubatorPassionArea();

  console.log("Passion taxonomy backfill complete.");
  console.log(
    `Challenges: scanned=${challengeResult.scanned}, updated=${challengeResult.updated}`
  );
  console.log(
    `Incubator projects: scanned=${incubatorResult.scanned}, updated=${incubatorResult.updated}`
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
