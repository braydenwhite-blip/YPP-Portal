import { describe, expect, it } from "vitest";

import {
  assertCanActAsChair,
  assertCanManageHiringInterviews,
  assertCanViewApplicant,
  canSeeChairQueue,
  isAdmin,
  isAssignedInterviewer,
  isAssignedReviewer,
  isHiringChair,
  type ApplicationContext,
  type HiringActor,
} from "@/lib/chapter-hiring-permissions";

function makeActor(overrides: Partial<HiringActor> = {}): HiringActor {
  return {
    id: "actor-1",
    chapterId: null,
    roles: [],
    featureKeys: new Set<string>(),
    ...overrides,
  };
}

function makeApplication(
  overrides: Partial<ApplicationContext> = {}
): ApplicationContext {
  return {
    id: "app-1",
    applicantId: "applicant-1",
    reviewerId: null,
    interviewRound: 1,
    applicantChapterId: "chap-1",
    interviewerAssignments: [],
    ...overrides,
  };
}

describe("chapter-hiring-permissions — HIRING_CHAIR coverage", () => {
  it("isHiringChair recognizes the HIRING_CHAIR role", () => {
    expect(isHiringChair(makeActor({ roles: ["HIRING_CHAIR"] }))).toBe(true);
    expect(isHiringChair(makeActor({ roles: ["ADMIN"] }))).toBe(false);
    expect(isHiringChair(makeActor({ roles: ["CHAPTER_PRESIDENT"] }))).toBe(false);
  });

  it("isAdmin and isHiringChair are independent flags", () => {
    const actor = makeActor({ roles: ["ADMIN", "HIRING_CHAIR"] });
    expect(isAdmin(actor)).toBe(true);
    expect(isHiringChair(actor)).toBe(true);
  });

  describe("canSeeChairQueue", () => {
    it("admits ADMIN and HIRING_CHAIR", () => {
      expect(canSeeChairQueue(makeActor({ roles: ["ADMIN"] }))).toBe(true);
      expect(canSeeChairQueue(makeActor({ roles: ["HIRING_CHAIR"] }))).toBe(true);
    });

    it("denies CHAPTER_PRESIDENT, INSTRUCTOR, STUDENT, and unauthenticated-shaped actors", () => {
      expect(canSeeChairQueue(makeActor({ roles: ["CHAPTER_PRESIDENT"] }))).toBe(false);
      expect(canSeeChairQueue(makeActor({ roles: ["INSTRUCTOR"] }))).toBe(false);
      expect(canSeeChairQueue(makeActor({ roles: ["STUDENT"] }))).toBe(false);
      expect(canSeeChairQueue(makeActor({ roles: [] }))).toBe(false);
    });
  });

  describe("assertCanActAsChair", () => {
    it("allows HIRING_CHAIR", () => {
      expect(() =>
        assertCanActAsChair(makeActor({ roles: ["HIRING_CHAIR"] }))
      ).not.toThrow();
    });

    it("allows ADMIN", () => {
      expect(() => assertCanActAsChair(makeActor({ roles: ["ADMIN"] }))).not.toThrow();
    });

    it("denies CHAPTER_PRESIDENT (chapter presidents are explicitly not chairs)", () => {
      expect(() =>
        assertCanActAsChair(
          makeActor({ roles: ["CHAPTER_PRESIDENT"], chapterId: "chap-1" })
        )
      ).toThrow(/Only Admins or Hiring Chairs/);
    });

    it("denies plain reviewers", () => {
      expect(() => assertCanActAsChair(makeActor({ roles: ["INSTRUCTOR"] }))).toThrow();
    });
  });

  describe("assertCanViewApplicant", () => {
    it("HIRING_CHAIR can view any applicant", () => {
      const actor = makeActor({ roles: ["HIRING_CHAIR"] });
      const app = makeApplication({ applicantChapterId: "chap-99" });
      expect(() => assertCanViewApplicant(actor, app)).not.toThrow();
    });

    it("ADMIN can view any applicant", () => {
      const actor = makeActor({ roles: ["ADMIN"] });
      const app = makeApplication({ applicantChapterId: "chap-99" });
      expect(() => assertCanViewApplicant(actor, app)).not.toThrow();
    });

    it("Chapter President can view only their own chapter's applicants", () => {
      const cp = makeActor({ roles: ["CHAPTER_PRESIDENT"], chapterId: "chap-1" });
      expect(() =>
        assertCanViewApplicant(cp, makeApplication({ applicantChapterId: "chap-1" }))
      ).not.toThrow();
      expect(() =>
        assertCanViewApplicant(cp, makeApplication({ applicantChapterId: "chap-2" }))
      ).toThrow(/own chapter/);
    });

    it("assigned reviewers can view their assigned application", () => {
      const reviewer = makeActor({ id: "reviewer-1" });
      const app = makeApplication({ reviewerId: "reviewer-1" });
      expect(isAssignedReviewer(reviewer, app)).toBe(true);
      expect(() => assertCanViewApplicant(reviewer, app)).not.toThrow();
    });

    it("assigned interviewers (current round) can view", () => {
      const interviewer = makeActor({ id: "int-1" });
      const app = makeApplication({
        interviewRound: 2,
        interviewerAssignments: [
          { interviewerId: "int-1", round: 2, removedAt: null },
        ],
      });
      expect(isAssignedInterviewer(interviewer, app)).toBe(true);
      expect(() => assertCanViewApplicant(interviewer, app)).not.toThrow();
    });

    it("strangers without any chair/reviewer relationship are denied", () => {
      const stranger = makeActor({ roles: ["INSTRUCTOR"] });
      expect(() => assertCanViewApplicant(stranger, makeApplication())).toThrow();
    });

    it("the applicant themselves can view their own application", () => {
      const applicant = makeActor({ id: "applicant-1" });
      expect(() =>
        assertCanViewApplicant(applicant, makeApplication({ applicantId: "applicant-1" }))
      ).not.toThrow();
    });
  });
});

describe("assertCanManageHiringInterviews — global authorities are not chapter-locked", () => {
  it("allows an Admin in any chapter", () => {
    const actor = makeActor({ roles: ["ADMIN"], chapterId: "chap-a" });
    expect(() => assertCanManageHiringInterviews(actor, "chap-b")).not.toThrow();
  });

  it("allows a global Hiring Chair across chapters", () => {
    const actor = makeActor({ roles: ["HIRING_CHAIR"], chapterId: "chap-a" });
    expect(() => assertCanManageHiringInterviews(actor, "chap-b")).not.toThrow();
  });

  it("keeps a plain Chapter President scoped to their own chapter", () => {
    const sameChapter = makeActor({ roles: ["CHAPTER_PRESIDENT"], chapterId: "chap-a" });
    expect(() => assertCanManageHiringInterviews(sameChapter, "chap-a")).not.toThrow();

    const crossChapter = makeActor({ roles: ["CHAPTER_PRESIDENT"], chapterId: "chap-a" });
    expect(() => assertCanManageHiringInterviews(crossChapter, "chap-b")).toThrow(
      /your own chapter/i
    );
  });
})
