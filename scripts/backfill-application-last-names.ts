import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

type Candidate = {
  id: string;
  kind: "InstructorApplication" | "ChapterPresidentApplication";
  legalName: string | null;
  applicant: { name: string | null; email: string };
};

function clean(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function deriveLastName(candidate: Candidate): string | null {
  const source = clean(candidate.legalName) || clean(candidate.applicant.name);
  if (!source || source.includes("@")) return null;

  const parts = source.split(" ").filter(Boolean);
  if (parts.length < 2) return null;

  const last = parts[parts.length - 1].replace(/[,.]+$/g, "");
  if (!last || last.length > 100) return null;
  return last;
}

async function main() {
  const [instructorRows, cpRows] = await Promise.all([
    prisma.instructorApplication.findMany({
      where: { OR: [{ lastName: null }, { lastName: "" }] },
      select: {
        id: true,
        legalName: true,
        applicant: { select: { name: true, email: true } },
      },
    }),
    prisma.chapterPresidentApplication.findMany({
      where: { OR: [{ lastName: null }, { lastName: "" }] },
      select: {
        id: true,
        legalName: true,
        applicant: { select: { name: true, email: true } },
      },
    }),
  ]);

  const candidates: Candidate[] = [
    ...instructorRows.map((row) => ({ ...row, kind: "InstructorApplication" as const })),
    ...cpRows.map((row) => ({ ...row, kind: "ChapterPresidentApplication" as const })),
  ];

  let updateable = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const lastName = deriveLastName(candidate);
    if (!lastName) {
      skipped++;
      continue;
    }

    updateable++;
    if (!apply) continue;

    if (candidate.kind === "InstructorApplication") {
      await prisma.instructorApplication.update({
        where: { id: candidate.id },
        data: { lastName },
      });
    } else {
      await prisma.chapterPresidentApplication.update({
        where: { id: candidate.id },
        data: { lastName },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        missingRows: candidates.length,
        updateable,
        skippedForManualReview: skipped,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
