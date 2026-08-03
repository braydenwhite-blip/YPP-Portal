import type { Prisma } from "@prisma/client";

/**
 * Display title for a performance review document, stored in
 * MentorGoalReview.nextMonthGoalDraftsJson so we don't need a new column.
 */
export type ReviewDocumentMeta = {
  documentTitle?: string;
};

export function readReviewDocumentTitle(json: unknown): string | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const title = (json as ReviewDocumentMeta).documentTitle;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

export function withReviewDocumentTitle(
  json: unknown,
  title: string,
): Prisma.InputJsonValue {
  const base =
    json && typeof json === "object" && !Array.isArray(json)
      ? { ...(json as Record<string, unknown>) }
      : {};
  base.documentTitle = title.trim();
  return base as Prisma.InputJsonValue;
}
