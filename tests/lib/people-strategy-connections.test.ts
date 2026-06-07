import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    classOffering: { findUnique: vi.fn() },
    mentorship: { findUnique: vi.fn(), findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    instructorApplication: { findUnique: vi.fn() },
    partner: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getMenteeSupport,
  loadRelatedEntitySummary,
} from "@/lib/people-strategy/connections";

const classFind = prisma.classOffering.findUnique as unknown as ReturnType<typeof vi.fn>;
const mentorshipFind = prisma.mentorship.findUnique as unknown as ReturnType<typeof vi.fn>;
const mentorshipFirst = prisma.mentorship.findFirst as unknown as ReturnType<typeof vi.fn>;
const userFind = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const partnerFind = prisma.partner.findUnique as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("loadRelatedEntitySummary", () => {
  it("returns null for an unknown type without querying", async () => {
    expect(await loadRelatedEntitySummary("DEPARTMENT", "d1")).toBeNull();
    expect(classFind).not.toHaveBeenCalled();
  });

  it("returns null for a blank id without querying", async () => {
    expect(await loadRelatedEntitySummary("CLASS_OFFERING", "   ")).toBeNull();
    expect(classFind).not.toHaveBeenCalled();
  });

  it("returns null (fails safe) when the entity no longer exists", async () => {
    classFind.mockResolvedValue(null);
    expect(await loadRelatedEntitySummary("CLASS_OFFERING", "c1")).toBeNull();
  });

  it("summarises a class with a safe detail href", async () => {
    classFind.mockResolvedValue({ id: "c1", title: "Intro to Robotics" });
    expect(await loadRelatedEntitySummary("CLASS_OFFERING", "  c1  ")).toEqual({
      type: "CLASS_OFFERING",
      id: "c1",
      label: "Intro to Robotics",
      typeLabel: "Class",
      href: "/admin/classes/c1",
    });
    expect(classFind).toHaveBeenCalledWith({
      where: { id: "c1" },
      select: { id: true, title: true },
    });
  });

  it("summarises a mentorship as 'Mentor → Mentee' keyed by the mentee user id", async () => {
    mentorshipFind.mockResolvedValue({
      id: "m1",
      mentor: { name: "Mira Mentor", email: "mira@x.org" },
      mentee: { id: "u9", name: "Theo Teen", email: "theo@x.org" },
    });
    expect(await loadRelatedEntitySummary("MENTORSHIP", "m1")).toEqual({
      type: "MENTORSHIP",
      id: "m1",
      label: "Mira Mentor → Theo Teen",
      typeLabel: "Mentorship",
      href: "/mentorship/mentees/u9",
    });
  });

  it("summarises a person, falling back to email when unnamed", async () => {
    userFind.mockResolvedValue({ id: "u1", name: null, email: "p@x.org" });
    expect(await loadRelatedEntitySummary("USER", "u1")).toEqual({
      type: "USER",
      id: "u1",
      label: "p@x.org",
      typeLabel: "Person",
      href: "/people/u1",
    });
  });

  it("summarises a partner with the admin partners href", async () => {
    partnerFind.mockResolvedValue({ id: "p1", name: "Beth El" });
    expect(await loadRelatedEntitySummary("PARTNER", "  p1  ")).toEqual({
      type: "PARTNER",
      id: "p1",
      label: "Beth El",
      typeLabel: "Partner",
      href: "/admin/partners",
    });
  });

  it("returns null (fails safe) for a partner that no longer exists", async () => {
    partnerFind.mockResolvedValue(null);
    expect(await loadRelatedEntitySummary("PARTNER", "gone")).toBeNull();
  });
});

describe("getMenteeSupport", () => {
  it("returns null for a blank user id without querying", async () => {
    expect(await getMenteeSupport("")).toBeNull();
    expect(mentorshipFirst).not.toHaveBeenCalled();
  });

  it("returns null when the person has no active mentor", async () => {
    mentorshipFirst.mockResolvedValue(null);
    expect(await getMenteeSupport("u1")).toBeNull();
    expect(mentorshipFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { menteeId: "u1", status: "ACTIVE" } })
    );
  });

  it("returns the active mentor relationship", async () => {
    mentorshipFirst.mockResolvedValue({
      id: "m1",
      type: "INSTRUCTOR",
      status: "ACTIVE",
      mentor: { id: "mentor1", name: "Mira", email: "mira@x.org" },
    });
    expect(await getMenteeSupport("u1")).toEqual({
      mentorshipId: "m1",
      mentor: { id: "mentor1", name: "Mira", email: "mira@x.org" },
      type: "INSTRUCTOR",
      status: "ACTIVE",
    });
  });
});
