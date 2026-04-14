import { prisma } from "@/lib/prisma";

type TableRow = {
  table_name: string;
};

type ColumnRow = {
  column_name: string;
};

const tablePresenceCache = new Map<string, Promise<boolean>>();
const columnSetCache = new Map<string, Promise<Set<string>>>();

let competitionDraftOwnershipPromise: Promise<boolean> | null = null;
let competitionPlanningDetailsPromise: Promise<boolean> | null = null;
let pathwayCohortTablePromise: Promise<boolean> | null = null;
let advancedSequenceBuilderSchemaPromise: Promise<boolean> | null = null;
let passionLabBuilderSchemaPromise: Promise<boolean> | null = null;
let instructorCohortTablesPromise: Promise<boolean> | null = null;

const PASSION_LAB_SPECIAL_PROGRAM_COLUMNS = [
  "name",
  "description",
  "interestArea",
  "type",
  "isVirtual",
  "isActive",
  "leaderId",
  "drivingQuestion",
  "targetAgeGroup",
  "difficulty",
  "deliveryMode",
  "finalShowcase",
  "labBlueprint",
  "sessionTopics",
  "submissionFormat",
  "maxParticipants",
  "startDate",
  "endDate",
  "chapterId",
  "createdById",
  "submissionStatus",
  "isTemplate",
  "templateCategory",
  "reviewNotes",
  "reviewedById",
  "createdAt",
  "updatedAt",
] as const;

export async function hasTable(tableName: string): Promise<boolean> {
  if (!tablePresenceCache.has(tableName)) {
    tablePresenceCache.set(
      tableName,
      prisma
        .$queryRaw<TableRow[]>`
          select table_name
          from information_schema.tables
          where table_schema = 'public'
            and table_name = ${tableName}
        `
        .then((rows) => rows.length > 0)
        .catch((error) => {
          tablePresenceCache.delete(tableName);
          throw error;
        })
    );
  }

  return tablePresenceCache.get(tableName)!;
}

export async function hasAllTables(tableNames: readonly string[]): Promise<boolean> {
  const results = await Promise.all(tableNames.map((tableName) => hasTable(tableName)));
  return results.every(Boolean);
}

async function getColumnSet(tableName: string): Promise<Set<string>> {
  if (!columnSetCache.has(tableName)) {
    columnSetCache.set(
      tableName,
      prisma
        .$queryRaw<ColumnRow[]>`
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = ${tableName}
        `
        .then((rows) => new Set(rows.map((row) => row.column_name)))
        .catch((error) => {
          columnSetCache.delete(tableName);
          throw error;
        })
    );
  }

  return columnSetCache.get(tableName)!;
}

export async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  const columnSet = await getColumnSet(tableName);
  return columnSet.has(columnName);
}

export async function hasColumns(
  tableName: string,
  columnNames: readonly string[]
): Promise<boolean> {
  const columnSet = await getColumnSet(tableName);
  return columnNames.every((columnName) => columnSet.has(columnName));
}

export async function hasCompetitionDraftOwnership(): Promise<boolean> {
  if (!competitionDraftOwnershipPromise) {
    competitionDraftOwnershipPromise = hasColumn("SeasonalCompetition", "createdById").catch(
      (error) => {
        competitionDraftOwnershipPromise = null;
        throw error;
      }
    );
  }

  return competitionDraftOwnershipPromise;
}

export async function hasCompetitionPlanningDetails(): Promise<boolean> {
  if (!competitionPlanningDetailsPromise) {
    competitionPlanningDetailsPromise = hasColumn(
      "SeasonalCompetition",
      "planningDetails"
    ).catch((error) => {
      competitionPlanningDetailsPromise = null;
      throw error;
    });
  }

  return competitionPlanningDetailsPromise;
}

export async function hasPathwayCohortTable(): Promise<boolean> {
  if (!pathwayCohortTablePromise) {
    pathwayCohortTablePromise = hasTable("PathwayCohort").catch((error) => {
      pathwayCohortTablePromise = null;
      throw error;
    });
  }

  return pathwayCohortTablePromise;
}

export async function hasAdvancedSequenceBuilderSchema(): Promise<boolean> {
  if (!advancedSequenceBuilderSchemaPromise) {
    advancedSequenceBuilderSchemaPromise = Promise.all([
      hasColumn("Pathway", "sequenceBlueprint"),
      hasColumn("PathwayStep", "stepDetails"),
    ])
      .then(([hasSequenceBlueprint, hasStepDetails]) => hasSequenceBlueprint && hasStepDetails)
      .catch((error) => {
        advancedSequenceBuilderSchemaPromise = null;
        throw error;
      });
  }

  return advancedSequenceBuilderSchemaPromise;
}

export async function hasPassionLabBuilderSchema(): Promise<boolean> {
  if (!passionLabBuilderSchemaPromise) {
    passionLabBuilderSchemaPromise = (async () => {
      const [hasRequiredTables, hasRequiredColumns] = await Promise.all([
        hasAllTables(["SpecialProgram", "ProgramSession", "SpecialProgramEnrollment"]),
        hasColumns("SpecialProgram", PASSION_LAB_SPECIAL_PROGRAM_COLUMNS),
      ]);

      return hasRequiredTables && hasRequiredColumns;
    })().catch((error) => {
      passionLabBuilderSchemaPromise = null;
      throw error;
    });
  }

  return passionLabBuilderSchemaPromise;
}

export async function hasInstructorCohortTables(): Promise<boolean> {
  if (!instructorCohortTablesPromise) {
    instructorCohortTablesPromise = hasAllTables([
      "InstructorCohort",
      "InstructorCohortMember",
    ]).catch((error) => {
      instructorCohortTablesPromise = null;
      throw error;
    });
  }

  return instructorCohortTablesPromise;
}
