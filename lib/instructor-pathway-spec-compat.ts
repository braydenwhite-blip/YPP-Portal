import { prisma } from "@/lib/prisma";

type TableRow = {
  table_name: string;
};

type ActivePathwaySummary = {
  id: string;
  name: string;
  interestArea: string;
  description: string | null;
  steps: Array<{ courseId: string | null }>;
  instructorSpecs: Array<{ id: string }>;
};

let instructorPathwaySpecTablePromise: Promise<boolean> | null = null;

export async function hasInstructorPathwaySpecTable(): Promise<boolean> {
  if (!instructorPathwaySpecTablePromise) {
    instructorPathwaySpecTablePromise = prisma
      .$queryRaw<TableRow[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'InstructorPathwaySpec'
      `
      .then((rows) => rows.length > 0)
      .catch((error) => {
        instructorPathwaySpecTablePromise = null;
        throw error;
      });
  }

  return instructorPathwaySpecTablePromise;
}

export async function getActivePathwaysForInstructorWorkspace(
  userId: string
): Promise<ActivePathwaySummary[]> {
  const hasSpecsTable = await hasInstructorPathwaySpecTable();

  if (hasSpecsTable) {
    return prisma.pathway.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        interestArea: true,
        description: true,
        steps: { select: { courseId: true } },
        instructorSpecs: {
          where: { userId },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  const pathways = await prisma.pathway.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      interestArea: true,
      description: true,
      steps: { select: { courseId: true } },
    },
    orderBy: { name: "asc" },
  });

  return pathways.map((pathway) => ({
    ...pathway,
    instructorSpecs: [],
  }));
}
