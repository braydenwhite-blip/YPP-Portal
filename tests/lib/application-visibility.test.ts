import { describe, expect, it } from "vitest";

import { instructorApplicationVisibilityWhereForActor } from "@/lib/applications/application-visibility";
import type { HiringActor } from "@/lib/chapter-hiring-permissions";

function makeActor(overrides: Partial<HiringActor> = {}): HiringActor {
  return {
    id: "actor-1",
    chapterId: null,
    roles: [],
    featureKeys: new Set<string>(),
    ...overrides,
  };
}

describe("instructorApplicationVisibilityWhereForActor", () => {
  it("allows admins and hiring chairs to use the unrestricted list filter", () => {
    expect(instructorApplicationVisibilityWhereForActor(makeActor({ roles: ["ADMIN"] }))).toEqual({});
    expect(
      instructorApplicationVisibilityWhereForActor(makeActor({ roles: ["HIRING_CHAIR"] }))
    ).toEqual({});
  });

  it("limits chapter presidents to their chapter plus orphan applications", () => {
    const where = instructorApplicationVisibilityWhereForActor(
      makeActor({
        id: "cp-1",
        chapterId: "chapter-1",
        roles: ["CHAPTER_PRESIDENT"],
      })
    );

    expect(where).toMatchObject({
      OR: expect.arrayContaining([
        { applicant: { chapterId: "chapter-1" } },
        { applicant: { chapterId: null } },
      ]),
    });
  });

  it("includes only active current-round interviewer assignments in list/search visibility", () => {
    const where = instructorApplicationVisibilityWhereForActor(makeActor({ id: "interviewer-1" }));

    expect(where).toMatchObject({
      OR: expect.arrayContaining([
        {
          AND: [
            { interviewRound: 1 },
            {
              interviewerAssignments: {
                some: {
                  interviewerId: "interviewer-1",
                  removedAt: null,
                  round: 1,
                },
              },
            },
          ],
        },
      ]),
    });
  });
});
