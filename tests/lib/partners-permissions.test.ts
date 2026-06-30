import { describe, it, expect, vi } from "vitest";

// Neutralize the server-only auth chain + prisma so the pure predicate imports cleanly.
vi.mock("@/lib/auth-supabase", () => ({ getSessionUser: vi.fn(async () => null) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { canManagePartnerForChapter, partnerScopeWhere, type PartnerScope } from "@/lib/partners/permissions";
import type { SessionUser } from "@/lib/authorization-roles";

function user(roles: string[], adminSubtypes: string[] = []): SessionUser {
  return { id: "u1", roles, primaryRole: roles[0] ?? "INSTRUCTOR", adminSubtypes } as unknown as SessionUser;
}

describe("canManagePartnerForChapter", () => {
  it("lets national leadership manage any chapter (including unassigned)", () => {
    expect(canManagePartnerForChapter(user(["ADMIN"]), "c1", null)).toBe(true);
    expect(canManagePartnerForChapter(user(["STAFF"]), "c2", "c1")).toBe(true);
    expect(canManagePartnerForChapter(user(["INSTRUCTOR"], ["LEADERSHIP"]), "cX", null)).toBe(true);
    expect(canManagePartnerForChapter(user(["ADMIN"]), null, null)).toBe(true);
  });

  it("lets a Chapter President manage only the chapter they lead", () => {
    expect(canManagePartnerForChapter(user(["CHAPTER_PRESIDENT"]), "c1", "c1")).toBe(true);
    expect(canManagePartnerForChapter(user(["CHAPTER_PRESIDENT"]), "c2", "c1")).toBe(false);
    expect(canManagePartnerForChapter(user(["CHAPTER_PRESIDENT"]), null, "c1")).toBe(false);
    expect(canManagePartnerForChapter(user(["CHAPTER_PRESIDENT"]), "c1", null)).toBe(false);
  });

  it("denies unrelated roles", () => {
    expect(canManagePartnerForChapter(user(["INSTRUCTOR"]), "c1", "c1")).toBe(false);
    expect(canManagePartnerForChapter(user(["MENTOR"]), "c1", null)).toBe(false);
  });
});

describe("partnerScopeWhere", () => {
  const scope = (over: Partial<PartnerScope>): PartnerScope => ({
    user: user(["CHAPTER_PRESIDENT"]),
    isLeadership: false,
    ledChapterId: null,
    ...over,
  });

  it("returns an unscoped active filter for leadership", () => {
    expect(partnerScopeWhere(scope({ isLeadership: true }))).toEqual({ archivedAt: null });
  });
  it("scopes a CP to their chapter", () => {
    expect(partnerScopeWhere(scope({ ledChapterId: "c1" }))).toEqual({ archivedAt: null, chapterId: "c1" });
  });
  it("a CP with no chapter sees nothing", () => {
    expect(partnerScopeWhere(scope({ ledChapterId: null }))).toEqual({ archivedAt: null, chapterId: "__none__" });
  });
});
