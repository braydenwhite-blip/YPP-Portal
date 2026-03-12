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
  hasAdvancedCurriculumFields: boolean;
  hasReviewWorkflow: boolean;
};

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

export function getClassTemplateSelect(options?: {
  includeCounts?: boolean;
  includeCreatedBy?: boolean;
  includeReviewedBy?: boolean;
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
