import { describe, it, expect } from "vitest";
import {
  CHAPTER_LIFECYCLE_STATUSES,
  CHAPTER_LIFECYCLE_LABELS,
  chapterLifecycleLabel,
  chapterLifecycleTone,
  isLaunchingStatus,
  isOperatingStatus,
  isTerminalStatus,
  isValidChapterLifecycleStatus,
  resolveChapterCommandView,
  CHAPTER_COMMAND_VIEWS,
} from "@/lib/chapters/lifecycle";

describe("chapter lifecycle", () => {
  it("has the eight pipeline stages with labels", () => {
    expect(CHAPTER_LIFECYCLE_STATUSES).toHaveLength(8);
    for (const status of CHAPTER_LIFECYCLE_STATUSES) {
      expect(CHAPTER_LIFECYCLE_LABELS[status]).toBeTruthy();
    }
  });

  it("labels and tones resolve, with safe fallbacks", () => {
    expect(chapterLifecycleLabel("ACTIVE")).toBe("Active");
    expect(chapterLifecycleLabel("ALUMNI")).toBe("Alumni / Closed");
    expect(chapterLifecycleLabel("WAT")).toBe("WAT");
    expect(chapterLifecycleTone("AT_RISK")).toBe("danger");
    expect(chapterLifecycleTone("ACTIVE")).toBe("success");
    expect(chapterLifecycleTone("???")).toBe("neutral");
  });

  it("classifies launching vs operating vs terminal", () => {
    expect(isLaunchingStatus("APPROVED")).toBe(true);
    expect(isLaunchingStatus("LAUNCHING")).toBe(true);
    expect(isLaunchingStatus("ACTIVE")).toBe(false);
    expect(isOperatingStatus("ACTIVE")).toBe(true);
    expect(isOperatingStatus("NEEDS_SUPPORT")).toBe(true);
    expect(isOperatingStatus("AT_RISK")).toBe(true);
    expect(isOperatingStatus("PROSPECT")).toBe(false);
    expect(isTerminalStatus("ALUMNI")).toBe(true);
    expect(isTerminalStatus("ACTIVE")).toBe(false);
  });

  it("validates status strings", () => {
    expect(isValidChapterLifecycleStatus("ACTIVE")).toBe(true);
    expect(isValidChapterLifecycleStatus("NONSENSE")).toBe(false);
  });

  it("resolves command views and defaults to 'all'", () => {
    expect(resolveChapterCommandView("at_risk").key).toBe("at_risk");
    expect(resolveChapterCommandView(undefined).key).toBe("all");
    expect(resolveChapterCommandView("nope").key).toBe("all");
    // Signal-based views carry a signal, lifecycle views carry statuses.
    const launching = CHAPTER_COMMAND_VIEWS.find((v) => v.key === "launching");
    expect(launching?.statuses).toContain("LAUNCHING");
    const noMeeting = CHAPTER_COMMAND_VIEWS.find((v) => v.key === "no_upcoming_meeting");
    expect(noMeeting?.signal).toBe("no_upcoming_meeting");
  });
});
