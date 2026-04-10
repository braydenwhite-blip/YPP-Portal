import { describe, expect, it } from "vitest";

import {
  canAccessCurriculumDraftForPrint,
  canAccessCurriculumDraftForStudio,
  canCommentOnCurriculumDraft,
  canEditCurriculumDraftInStudio,
  canResolveCurriculumDraftComments,
} from "@/lib/curriculum-draft-access";

describe("curriculum-draft-access", () => {
  it("allows the author and admins to open the print view", () => {
    expect(
      canAccessCurriculumDraftForPrint({
        requesterId: "author-1",
        requesterRoles: ["INSTRUCTOR"],
        authorId: "author-1",
      })
    ).toBe(true);

    expect(
      canAccessCurriculumDraftForPrint({
        requesterId: "admin-1",
        requesterRoles: ["ADMIN"],
        authorId: "author-1",
      })
    ).toBe(true);
  });

  it("allows chapter presidents only when they share the author's chapter", () => {
    expect(
      canAccessCurriculumDraftForPrint({
        requesterId: "lead-1",
        requesterRoles: ["CHAPTER_PRESIDENT"],
        requesterChapterId: "chapter-1",
        authorId: "author-1",
        authorChapterId: "chapter-1",
      })
    ).toBe(true);

    expect(
      canAccessCurriculumDraftForPrint({
        requesterId: "lead-2",
        requesterRoles: ["CHAPTER_PRESIDENT"],
        requesterChapterId: "chapter-2",
        authorId: "author-1",
        authorChapterId: "chapter-1",
      })
    ).toBe(false);
  });

  it("lets reviewers view and comment in the studio without unlocking editing", () => {
    expect(
      canAccessCurriculumDraftForStudio({
        requesterId: "admin-1",
        requesterRoles: ["ADMIN"],
        authorId: "author-1",
        draftStatus: "SUBMITTED",
      })
    ).toBe(true);

    expect(
      canCommentOnCurriculumDraft({
        requesterId: "lead-1",
        requesterRoles: ["CHAPTER_PRESIDENT"],
        requesterChapterId: "chapter-1",
        authorId: "author-1",
        authorChapterId: "chapter-1",
        draftStatus: "SUBMITTED",
      })
    ).toBe(true);

    expect(
      canEditCurriculumDraftInStudio({
        requesterId: "admin-1",
        requesterRoles: ["ADMIN"],
        authorId: "author-1",
        draftStatus: "IN_PROGRESS",
      })
    ).toBe(false);
  });

  it("only lets authors edit, and only while the draft is in an editable status", () => {
    expect(
      canEditCurriculumDraftInStudio({
        requesterId: "author-1",
        requesterRoles: ["INSTRUCTOR"],
        authorId: "author-1",
        draftStatus: "IN_PROGRESS",
      })
    ).toBe(true);

    expect(
      canEditCurriculumDraftInStudio({
        requesterId: "author-1",
        requesterRoles: ["INSTRUCTOR"],
        authorId: "author-1",
        draftStatus: "NEEDS_REVISION",
      })
    ).toBe(true);

    expect(
      canEditCurriculumDraftInStudio({
        requesterId: "author-1",
        requesterRoles: ["INSTRUCTOR"],
        authorId: "author-1",
        draftStatus: "SUBMITTED",
      })
    ).toBe(false);
  });

  it("lets admins and same-chapter presidents resolve comments", () => {
    expect(
      canResolveCurriculumDraftComments({
        requesterId: "admin-1",
        requesterRoles: ["ADMIN"],
        authorId: "author-1",
        draftStatus: "SUBMITTED",
      })
    ).toBe(true);

    expect(
      canResolveCurriculumDraftComments({
        requesterId: "lead-1",
        requesterRoles: ["CHAPTER_PRESIDENT"],
        requesterChapterId: "chapter-1",
        authorId: "author-1",
        authorChapterId: "chapter-1",
        draftStatus: "SUBMITTED",
      })
    ).toBe(true);

    expect(
      canResolveCurriculumDraftComments({
        requesterId: "lead-2",
        requesterRoles: ["CHAPTER_PRESIDENT"],
        requesterChapterId: "chapter-2",
        authorId: "author-1",
        authorChapterId: "chapter-1",
        draftStatus: "SUBMITTED",
      })
    ).toBe(false);
  });
});
