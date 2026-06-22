import { describe, expect, it } from "vitest";

import { resolvePersonAuthority } from "@/lib/org/levels";
import { summarizePersonAccess } from "@/lib/org/access-explainer";
import {
  detectAccessProblems,
  hasAccessProblems,
  type AccessProbe,
} from "@/lib/org/access-problems";

function codes(facts: ReturnType<typeof summarizePersonAccess>): string[] {
  return facts.map((f) => f.code);
}

describe("summarizePersonAccess — proposal example statements", () => {
  it("explains a mentee relationship by name", () => {
    const facts = summarizePersonAccess({
      name: "Sam",
      authority: resolvePersonAuthority({ title: "Senior Officer" }),
      mentees: [{ id: "j1", name: "Jackson" }],
    });
    expect(
      facts.some((f) => f.code === "mentee" && /Jackson is assigned as their mentee/.test(f.statement))
    ).toBe(true);
  });

  it("explains Instruction Committee curriculum approval for a Lead Instructor", () => {
    const facts = summarizePersonAccess({
      name: "Lina",
      authority: resolvePersonAuthority({ title: "Lead Instructor" }),
    });
    expect(
      facts.some((f) => f.code === "instruction_committee" && /approve curriculum/.test(f.statement))
    ).toBe(true);
  });

  it("explains chapter access for a Chapter President", () => {
    const facts = summarizePersonAccess({
      name: "Pat",
      authority: resolvePersonAuthority({ title: "Chapter President" }),
      isChapterPresident: true,
      chapter: { id: "c1", name: "Boston" },
    });
    expect(
      facts.some((f) => f.code === "chapter_president" && /Chapter President of Boston/.test(f.statement))
    ).toBe(true);
  });

  it("explains an Input assignment on an action", () => {
    const facts = summarizePersonAccess({
      name: "Dev",
      authority: resolvePersonAuthority({ title: "Instructor" }),
      actionAssignments: [{ id: "a1", title: "Curriculum review", role: "INPUT" }],
    });
    expect(
      facts.some((f) => f.code === "action_assignment" && /assigned as Input/.test(f.statement))
    ).toBe(true);
  });

  it("explains global Action Tracker access for a Manager", () => {
    const facts = summarizePersonAccess({
      name: "Max",
      authority: resolvePersonAuthority({ title: "Manager" }),
    });
    expect(
      facts.some((f) => f.code === "global_action_tracker" && /global Action Tracker/.test(f.statement))
    ).toBe(true);
  });

  it("notes when an instructor cannot lead actions", () => {
    const facts = summarizePersonAccess({
      name: "Ivy",
      authority: resolvePersonAuthority({ title: "Instructor" }),
    });
    const leadFact = facts.find((f) => f.code === "action_lead");
    expect(leadFact?.kind).toBe("limit");
  });

  it("grants Board Members universal access", () => {
    const facts = summarizePersonAccess({
      name: "Bea",
      authority: resolvePersonAuthority({ adminSubtypes: ["SUPER_ADMIN"] }),
    });
    expect(codes(facts)).toContain("board_universal");
  });
});

describe("detectAccessProblems", () => {
  const probes: AccessProbe[] = [
    {
      resourceType: "interview_review",
      resourceId: "ir1",
      label: "Interview review — A. Lee",
      expected: true,
      actual: false,
      expectedReason: "Officers have universal operational access.",
    },
    {
      resourceType: "chapter",
      resourceId: "c1",
      label: "Boston chapter",
      expected: true,
      actual: true,
    },
    {
      resourceType: "officer_review",
      resourceId: "or1",
      label: "Confidential officer review",
      expected: false,
      actual: false,
    },
  ];

  it("reports only expected-but-denied records", () => {
    const problems = detectAccessProblems(probes);
    expect(problems).toHaveLength(1);
    expect(problems[0].resourceType).toBe("interview_review");
    expect(problems[0].reason).toMatch(/universal operational access/);
  });

  it("hasAccessProblems mirrors the detector", () => {
    expect(hasAccessProblems(probes)).toBe(true);
    expect(hasAccessProblems([{ ...probes[1] }])).toBe(false);
  });
});
