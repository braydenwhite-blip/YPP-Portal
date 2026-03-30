import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CurriculumSubmissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "NEEDS_REVISION";

type ClassTemplateColumnRow = {
  column_name: string;
};

type ClassTemplateCapabilities = {
  hasLearnerFitFields: boolean;
  hasAdvancedCurriculumFields: boolean;
  hasReviewWorkflow: boolean;
};

const LEARNER_FIT_COLUMNS = [
  "learnerFitLabel",
  "learnerFitDescription",
] as const;

const ADVANCED_CLASS_TEMPLATE_COLUMNS = [
  "targetAgeGroup",
  "classDurationMin",
  "engagementStrategy",
] as const;

const REVIEW_WORKFLOW_COLUMNS = [
  "submissionStatus",
  "submittedAt",
  "reviewedById",
  "reviewNotes",
] as const;

let classTemplateCapabilitiesPromise: Promise<ClassTemplateCapabilities> | null = null;

type ClassTemplateMutationClient = Pick<typeof prisma, "$queryRaw"> & {
  classTemplate: Pick<typeof prisma.classTemplate, "create">;
};

export type CompatibleClassTemplateCreateInput = {
  title: string;
  description: string;
  interestArea: string;
  difficultyLevel: "LEVEL_101" | "LEVEL_201" | "LEVEL_301" | "LEVEL_401";
  learnerFitLabel?: string | null;
  learnerFitDescription?: string | null;
  prerequisites: string[];
  weeklyTopics: Prisma.InputJsonValue;
  learningOutcomes: string[];
  estimatedHours: number;
  durationWeeks: number;
  sessionsPerWeek: number;
  minStudents: number;
  maxStudents: number;
  idealSize: number;
  sizeNotes?: string | null;
  deliveryModes: string[];
  targetAgeGroup?: string | null;
  classDurationMin?: number | null;
  engagementStrategy?: Prisma.InputJsonValue | null;
  submissionStatus?: CurriculumSubmissionStatus;
  submittedAt?: Date | null;
  reviewedById?: string | null;
  reviewNotes?: string | null;
  isPublished?: boolean;
  createdById: string;
  chapterId?: string | null;
};

function sqlTextArray(values: string[]): Prisma.Sql {
  if (values.length === 0) {
    return Prisma.sql`ARRAY[]::text[]`;
  }

  return Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]`;
}

function sqlJson(value: Prisma.InputJsonValue): Prisma.Sql {
  return Prisma.sql`CAST(${JSON.stringify(value)} AS jsonb)`;
}

export async function getClassTemplateCapabilities(): Promise<ClassTemplateCapabilities> {
  if (!classTemplateCapabilitiesPromise) {
    classTemplateCapabilitiesPromise = prisma
      .$queryRaw<ClassTemplateColumnRow[]>`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'ClassTemplate'
      `
      .then((rows) => {
        const columns = new Set(rows.map((row) => row.column_name));
        return {
          hasLearnerFitFields: LEARNER_FIT_COLUMNS.every((column) => columns.has(column)),
          hasAdvancedCurriculumFields: ADVANCED_CLASS_TEMPLATE_COLUMNS.every((column) =>
            columns.has(column)
          ),
          hasReviewWorkflow: REVIEW_WORKFLOW_COLUMNS.every((column) => columns.has(column)),
        };
      })
      .catch((error) => {
        classTemplateCapabilitiesPromise = null;
        throw error;
      });
  }

  return classTemplateCapabilitiesPromise;
}

export async function createCompatibleClassTemplate(
  client: ClassTemplateMutationClient,
  capabilities: ClassTemplateCapabilities,
  input: CompatibleClassTemplateCreateInput
) {
  const createData: Prisma.ClassTemplateUncheckedCreateInput = {
    title: input.title,
    description: input.description,
    interestArea: input.interestArea,
    difficultyLevel: input.difficultyLevel,
    prerequisites: input.prerequisites,
    weeklyTopics: input.weeklyTopics,
    learningOutcomes: input.learningOutcomes,
    estimatedHours: input.estimatedHours,
    durationWeeks: input.durationWeeks,
    sessionsPerWeek: input.sessionsPerWeek,
    minStudents: input.minStudents,
    maxStudents: input.maxStudents,
    idealSize: input.idealSize,
    sizeNotes: input.sizeNotes ?? null,
    deliveryModes: input.deliveryModes,
    isPublished: input.isPublished ?? false,
    createdById: input.createdById,
    chapterId: input.chapterId ?? null,
    ...(capabilities.hasLearnerFitFields
      ? {
          learnerFitLabel: input.learnerFitLabel ?? null,
          learnerFitDescription: input.learnerFitDescription ?? null,
        }
      : {}),
    ...(capabilities.hasAdvancedCurriculumFields
      ? {
          targetAgeGroup: input.targetAgeGroup ?? null,
          classDurationMin: input.classDurationMin ?? null,
          ...(input.engagementStrategy != null
            ? { engagementStrategy: input.engagementStrategy }
            : {}),
        }
      : {}),
    ...(capabilities.hasReviewWorkflow
      ? {
          submissionStatus: input.submissionStatus ?? "DRAFT",
          submittedAt: input.submittedAt ?? null,
          reviewedById: input.reviewedById ?? null,
          reviewNotes: input.reviewNotes ?? null,
        }
      : {}),
  };

  if (capabilities.hasReviewWorkflow) {
    return client.classTemplate.create({
      data: createData,
      select: { id: true },
    });
  }

  const id = randomUUID();
  const now = new Date();
  const columns: Prisma.Sql[] = [
    Prisma.raw(`"id"`),
    Prisma.raw(`"title"`),
    Prisma.raw(`"description"`),
    Prisma.raw(`"interestArea"`),
    Prisma.raw(`"difficultyLevel"`),
    Prisma.raw(`"prerequisites"`),
    Prisma.raw(`"weeklyTopics"`),
    Prisma.raw(`"learningOutcomes"`),
    Prisma.raw(`"estimatedHours"`),
    Prisma.raw(`"durationWeeks"`),
    Prisma.raw(`"sessionsPerWeek"`),
    Prisma.raw(`"minStudents"`),
    Prisma.raw(`"maxStudents"`),
    Prisma.raw(`"idealSize"`),
    Prisma.raw(`"sizeNotes"`),
    Prisma.raw(`"deliveryModes"`),
    Prisma.raw(`"isPublished"`),
    Prisma.raw(`"createdById"`),
    Prisma.raw(`"chapterId"`),
    Prisma.raw(`"createdAt"`),
    Prisma.raw(`"updatedAt"`),
  ];

  const values: Prisma.Sql[] = [
    Prisma.sql`${id}`,
    Prisma.sql`${input.title}`,
    Prisma.sql`${input.description}`,
    Prisma.sql`${input.interestArea}`,
    Prisma.sql`${input.difficultyLevel}`,
    sqlTextArray(input.prerequisites),
    sqlJson(input.weeklyTopics),
    sqlTextArray(input.learningOutcomes),
    Prisma.sql`${input.estimatedHours}`,
    Prisma.sql`${input.durationWeeks}`,
    Prisma.sql`${input.sessionsPerWeek}`,
    Prisma.sql`${input.minStudents}`,
    Prisma.sql`${input.maxStudents}`,
    Prisma.sql`${input.idealSize}`,
    Prisma.sql`${input.sizeNotes ?? null}`,
    sqlTextArray(input.deliveryModes),
    Prisma.sql`${input.isPublished ?? false}`,
    Prisma.sql`${input.createdById}`,
    Prisma.sql`${input.chapterId ?? null}`,
    Prisma.sql`${now}`,
    Prisma.sql`${now}`,
  ];

  if (capabilities.hasLearnerFitFields) {
    columns.push(Prisma.raw(`"learnerFitLabel"`), Prisma.raw(`"learnerFitDescription"`));
    values.push(
      Prisma.sql`${input.learnerFitLabel ?? null}`,
      Prisma.sql`${input.learnerFitDescription ?? null}`
    );
  }

  if (capabilities.hasAdvancedCurriculumFields) {
    columns.push(Prisma.raw(`"targetAgeGroup"`), Prisma.raw(`"classDurationMin"`));
    values.push(
      Prisma.sql`${input.targetAgeGroup ?? null}`,
      Prisma.sql`${input.classDurationMin ?? null}`
    );

    if (input.engagementStrategy != null) {
      columns.push(Prisma.raw(`"engagementStrategy"`));
      values.push(sqlJson(input.engagementStrategy));
    }
  }

  const rows = await client.$queryRaw<{ id: string }[]>(Prisma.sql`
    INSERT INTO "ClassTemplate" (${Prisma.join(columns)})
    VALUES (${Prisma.join(values)})
    RETURNING "id"
  `);

  const [row] = rows;
  if (!row) {
    throw new Error("Failed to create class template");
  }

  return row;
}

export function getClassTemplateSelect(options?: {
  includeCounts?: boolean;
  includeCreatedBy?: boolean;
  includeReviewedBy?: boolean;
  includeLearnerFit?: boolean;
  includeWorkflow?: boolean;
  includeAdvanced?: boolean;
}): Prisma.ClassTemplateSelect {
  const select: Prisma.ClassTemplateSelect = {
    id: true,
    title: true,
    description: true,
    interestArea: true,
    difficultyLevel: true,
    weeklyTopics: true,
    learningOutcomes: true,
    durationWeeks: true,
    sessionsPerWeek: true,
    minStudents: true,
    maxStudents: true,
    idealSize: true,
    sizeNotes: true,
    deliveryModes: true,
    isPublished: true,
    createdById: true,
    chapterId: true,
    createdAt: true,
    updatedAt: true,
  };

  if (options?.includeLearnerFit !== false) {
    select.learnerFitLabel = true;
    select.learnerFitDescription = true;
  }

  if (options?.includeCounts) {
    select._count = { select: { offerings: true } };
  }

  if (options?.includeCreatedBy) {
    select.createdBy = {
      select: {
        id: true,
        name: true,
        email: true,
        chapter: { select: { name: true } },
      },
    };
  }

  if (options?.includeReviewedBy && options?.includeWorkflow) {
    select.reviewedBy = {
      select: { id: true, name: true },
    };
  }

  if (options?.includeWorkflow) {
    select.submissionStatus = true;
    select.submittedAt = true;
    select.reviewNotes = true;
  }

  if (options?.includeAdvanced) {
    select.targetAgeGroup = true;
    select.classDurationMin = true;
    select.engagementStrategy = true;
  }

  return select;
}

export function getTemplateSubmissionStatus(
  template: { isPublished: boolean; submissionStatus?: string | null },
  hasReviewWorkflow: boolean
): CurriculumSubmissionStatus {
  if (hasReviewWorkflow && template.submissionStatus) {
    return template.submissionStatus as CurriculumSubmissionStatus;
  }

  return template.isPublished ? "APPROVED" : "DRAFT";
}
