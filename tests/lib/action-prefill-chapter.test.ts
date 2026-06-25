import { describe, expect, it } from "vitest";

import {
  actionPrefillFromQuery,
  actionPrefillToQuery,
  buildActionPrefillFromChapter,
  buildActionPrefillFromDecision,
  buildActionPrefillFromEntity,
  buildActionPrefillFromMeeting,
  buildActionPrefillFromMeetingFollowUp,
} from "@/lib/people-strategy/action-prefill";

describe("action prefill — chapter context propagation", () => {
  it("round-trips chapterId through the query string", () => {
    const href = actionPrefillToQuery({ chapterId: "chap-1", title: "Recruit members" });
    expect(href).toContain("chapter=chap-1");
    const parsed = actionPrefillFromQuery(new URLSearchParams(href.split("?")[1]));
    expect(parsed.chapterId).toBe("chap-1");
  });

  it("a chapter prefill is born chapter-scoped with the CP as suggested owner", () => {
    const p = buildActionPrefillFromChapter({ chapterId: "chap-1", suggestedOwnerId: "cp1" });
    expect(p.chapterId).toBe("chap-1");
    expect(p.suggestedOwnerId).toBe("cp1");
    expect(p.sourceType).toBe("ENTITY");
  });

  it("carries chapterId from meeting, decision, follow-up, and entity sources", () => {
    expect(
      buildActionPrefillFromMeeting({ meetingId: "m1", chapterId: "chap-1" }).chapterId
    ).toBe("chap-1");
    expect(
      buildActionPrefillFromDecision({
        decision: "Do the thing",
        meetingId: "m1",
        chapterId: "chap-1",
      }).chapterId
    ).toBe("chap-1");
    expect(
      buildActionPrefillFromMeetingFollowUp({
        followUpId: "f1",
        title: "Follow up",
        meetingId: "m1",
        chapterId: "chap-1",
      }).chapterId
    ).toBe("chap-1");
    expect(
      buildActionPrefillFromEntity({ type: "PARTNER", id: "p1", chapterId: "chap-1" }).chapterId
    ).toBe("chap-1");
  });

  it("omits the chapter param when there is no chapter context", () => {
    const href = actionPrefillToQuery({ title: "No chapter" });
    expect(href).not.toContain("chapter=");
    expect(actionPrefillFromQuery(new URLSearchParams(href.split("?")[1] ?? "")).chapterId).toBeUndefined();
  });
});
