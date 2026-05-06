// Seed three approved workshop proposal templates so the applicant library
// has something to show in a fresh environment.
//
// Idempotent: keyed by (title, createdById) — re-running the script updates
// fields rather than duplicating rows. Pick an admin user as the author so
// the rows pass FK constraints in environments that lack a system user.
//
// Usage:  node scripts/seed-workshop-proposal-templates.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEMPLATES = [
  {
    title: "Build a Paper-Bridge: Engineering for Beginners",
    category: "STEM",
    targetAgeRange: "Grades 4–6",
    estimatedMinutes: 60,
    description:
      "Hands-on intro to structural engineering. Students design, test, and iterate on a small paper bridge that holds weight — learning load, tension, and compression along the way.",
    learningObjectives: [
      "Identify forces acting on a bridge (load, tension, compression).",
      "Iterate on a design after testing reveals a weakness.",
      "Explain one trade-off they made between strength and material use.",
    ],
    activityPlan: `1. Hook (5 min): Show two bridges (one strong, one collapsing) — ask why.
2. Introduce vocab (5 min): load, tension, compression, with hand demos.
3. Build round 1 (15 min): pairs build a paper bridge between two desks.
4. Test (5 min): add weights, video the moment of failure.
5. Iterate (15 min): redesign with one new technique you saw work.
6. Test 2 + share-out (10 min): each pair names their best move.
7. Wrap (5 min): one-sentence answer — "What's the strongest shape?"`,
    materials: [
      "Cardstock paper (10 sheets per pair)",
      "Tape (1 roll per pair)",
      "Scissors",
      "Small weights (pennies or washers, ~50)",
      "Two desks or boxes for span",
    ],
    difficulty: "BEGINNER",
    tags: ["engineering", "iterative-design", "team"],
    status: "APPROVED",
  },
  {
    title: "Storytellers' Circle: Writing Your Origin Myth",
    category: "Writing",
    targetAgeRange: "Grades 6–8",
    estimatedMinutes: 75,
    description:
      "Students draft a short origin myth using a 5-step story scaffold. Pairs read aloud and give one piece of feedback using a structured rubric.",
    learningObjectives: [
      "Apply a 5-step story scaffold (call, descent, gift, return, lesson) to original writing.",
      "Give one specific, kind, useful piece of feedback to a peer.",
      "Revise one passage based on feedback received.",
    ],
    activityPlan: `1. Hook (5 min): read a 1-page origin myth aloud.
2. Scaffold (10 min): unpack the 5 steps with a familiar example (Spider-Man works).
3. Draft (25 min): students write their own origin myth — 1 paragraph per step.
4. Pair share (15 min): read aloud, give one "I noticed…" feedback line.
5. Revise (10 min): pick one feedback note and rewrite that section.
6. Open mic (10 min): 3 volunteers read their revised piece.
Backup: if the room is shy, offer a "shadow draft" — write privately and
the instructor reads it aloud anonymously.`,
    materials: [
      "Lined paper (5 sheets per student)",
      "Pencils",
      "Printed feedback rubric (1 per student)",
      "Example myth handout",
    ],
    difficulty: "INTERMEDIATE",
    tags: ["writing", "feedback", "creativity"],
    status: "APPROVED",
  },
  {
    title: "Code Your First Game: Variables and Movement",
    category: "Computer Science",
    targetAgeRange: "Grades 5–8",
    estimatedMinutes: 90,
    description:
      "Build a simple Scratch game where a character collects items. Introduces variables, events, and conditionals through play. No prior coding experience needed.",
    learningObjectives: [
      "Use variables to track score in a game.",
      "Trigger movement and collisions with event blocks.",
      "Explain what a conditional does in their own words.",
    ],
    activityPlan: `1. Hook (5 min): play a teacher-made demo game; ask "what made it work?".
2. Tour Scratch (10 min): sprites, scripts, the green flag.
3. Move (15 min): make a sprite move with arrow keys.
4. Score (15 min): add a Score variable and increase on collision.
5. Win condition (15 min): conditional — when score = 10, show "You win!".
6. Remix time (20 min): students change one rule (faster, more items, etc.).
7. Showcase (10 min): each student shows the rule they changed.
Backup: if Wi-Fi fails, switch to "unplugged" Scratch — paper-pencil flowcharts
of the same logic.`,
    materials: [
      "1 laptop or tablet per student (Scratch runs in browser)",
      "Pre-made starter project link",
      "Printed block reference sheet",
    ],
    difficulty: "BEGINNER",
    tags: ["coding", "scratch", "games"],
    status: "APPROVED",
  },
];

async function main() {
  // Pick any admin user as the seed author. Fail loudly if there is none —
  // the seed needs a real FK target.
  const admin = await prisma.user.findFirst({
    where: { roles: { some: { role: "ADMIN" } } },
    select: { id: true, email: true },
  });
  if (!admin) {
    throw new Error(
      "No admin user found. Create an admin user before seeding workshop templates."
    );
  }
  console.log(`Seeding workshop templates as ${admin.email}…`);

  for (const t of TEMPLATES) {
    const existing = await prisma.workshopProposalTemplate.findFirst({
      where: { title: t.title, createdById: admin.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.workshopProposalTemplate.update({
        where: { id: existing.id },
        data: {
          ...t,
          updatedById: admin.id,
        },
      });
      console.log(`  updated:  ${t.title}`);
    } else {
      await prisma.workshopProposalTemplate.create({
        data: {
          ...t,
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
      console.log(`  created:  ${t.title}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
