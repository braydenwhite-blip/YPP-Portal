/**
 * Assign canonical org-ladder titles to specific people, from the
 * "Permissions by Cohort" spec. Sets User.canonicalTitle / internalLevel /
 * ladder / title from the canonical taxonomy in lib/org/levels.ts (the same
 * columns the Promote form writes).
 *
 * Idempotent: it writes the SAME values on every run, never deletes, and skips
 * any email it can't find (with a warning). Dry-run by default; --apply to write.
 *
 *   npx tsx scripts/assign-cohort-titles.ts           # dry run (prints plan)
 *   npx tsx scripts/assign-cohort-titles.ts --apply    # write
 *
 * IMPORTANT: confirm the EDIT-ME emails below against real accounts before
 * running with --apply. Unmatched emails are reported and skipped, so a wrong
 * address is a no-op (never mis-assigns someone else).
 */

import { prisma } from "@/lib/prisma";
import { TITLE_AUTHORITY, type CanonicalTitle } from "@/lib/org/levels";

const apply = process.argv.includes("--apply");

type Assignment = {
  email: string;
  title: CanonicalTitle;
  /** false = the email is a best-guess that still needs confirming. */
  verified: boolean;
};

// From the PDF. `verified` emails come from the seed; the rest follow the
// firstname.lastname@youthpassionproject.org convention and MUST be confirmed.
const ASSIGNMENTS: Assignment[] = [
  // Instruction ladder
  { email: "milo.wald@youthpassionproject.org", title: "Chapter President", verified: true },

  // Leadership ladder — Officers
  { email: "anthea.zamir@youthpassionproject.org", title: "Officer", verified: true },
  { email: "sanvi.____@youthpassionproject.org", title: "Officer", verified: false }, // EDIT ME

  // Leadership ladder — Senior Officers
  { email: "brayden.white@youthpassionproject.org", title: "Senior Officer", verified: true },
  { email: "ian.____@youthpassionproject.org", title: "Senior Officer", verified: false }, // EDIT ME
  { email: "aveena.____@youthpassionproject.org", title: "Senior Officer", verified: false }, // EDIT ME

  // ── EDIT ME: remaining instructors / mentors named in the PDF ──────────────
  // Fill in real emails + the intended canonical title, then uncomment.
  // Mentors (Zach, Sam) and mentees (Jackson, Jennifer, Alina, Wesley) had no
  // explicit ladder title in the spec — set per their actual role.
  // { email: "zach.____@youthpassionproject.org",     title: "Senior Instructor", verified: false },
  // { email: "sam.____@youthpassionproject.org",      title: "Senior Instructor", verified: false },
  // { email: "jackson.____@youthpassionproject.org",  title: "Instructor",        verified: false },
  // { email: "jennifer.____@youthpassionproject.org", title: "Instructor",        verified: false },
  // { email: "alina.____@youthpassionproject.org",    title: "Instructor",        verified: false },
  // { email: "wesley.____@youthpassionproject.org",   title: "Instructor",        verified: false },
];

async function main(): Promise<void> {
  console.log(
    apply ? "Applying cohort title assignments…\n" : "DRY RUN — pass --apply to write.\n"
  );

  let updated = 0;
  let missing = 0;
  let unverified = 0;

  for (const a of ASSIGNMENTS) {
    const meta = TITLE_AUTHORITY[a.title];
    const user = await prisma.user.findFirst({
      where: { email: { equals: a.email, mode: "insensitive" } },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      missing += 1;
      console.warn(`  ! no account for ${a.email} — skipped`);
      continue;
    }
    if (!a.verified) unverified += 1;

    updated += 1;
    console.log(
      `  ${user.name} <${user.email}> → ${a.title}` +
        ` (level ${meta.internalLevel} · ${meta.ladder})` +
        `${a.verified ? "" : " [UNVERIFIED EMAIL]"}${apply ? "" : " (dry run)"}`
    );

    if (apply) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          title: a.title,
          canonicalTitle: a.title,
          internalLevel: meta.internalLevel,
          ladder: meta.ladder,
        },
      });
    }
  }

  console.log(
    `\n${updated} ${apply ? "updated" : "to update"}, ${missing} not found, ` +
      `${unverified} matched on an unverified email.`
  );
  if (missing > 0 || unverified > 0) {
    console.log(
      "Confirm any unverified/missing emails against real accounts, then re-run."
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
