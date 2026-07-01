import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `ChapterOSRooms` transitively imports `lib/chapters/room-action-server.ts` ->
// `lib/chapters/snapshot-capture.ts` -> `lib/chapters/chapter-os.ts` ->
// `lib/chapters/operating-system.ts` -> `lib/portal-settings` (a server module
// that memoizes with React's `cache`, unavailable on the React 18 CJS build
// jsdom resolves here). Mock it so the transitive import chain is inert for
// this render-only test — pre-existing repo gap, not specific to this file.
vi.mock("@/lib/portal-settings", () => ({
  getPortalSettings: vi.fn(),
  PORTAL_SETTINGS_DEFAULTS: {},
}));

import { ChapterOSRooms } from "@/components/chapters/chapter-os-rooms";

// Minimal-but-valid fixture: only the fields ChapterOSRooms actually reads
// (chapter.id, weekNumber, focus, needsYou, rooms, recentActivity, nowISO) are
// populated meaningfully; everything else is omitted since it isn't exercised
// by this component. `ChapterOSModel` is intentionally NOT imported here (even
// type-only) to keep this test decoupled from that module's shape.
type ChapterOSModelFixture = Parameters<typeof ChapterOSRooms>[0]["model"];

function model(overrides: Record<string, unknown> = {}): ChapterOSModelFixture {
  return {
    chapter: { id: "chapter-1" },
    weekNumber: 3,
    focus: "Partner outreach",
    rooms: [],
    needsYou: [],
    recentActivity: [],
    nowISO: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as unknown as ChapterOSModelFixture;
}

describe("ChapterOSRooms", () => {
  it("renders the workflow card slot between the Mission Brief and the room grid", () => {
    render(
      <ChapterOSRooms
        model={model()}
        workflowCard={<div data-testid="workflow-card">Active chapter workflows</div>}
      />
    );

    // Mission Brief heading renders above the workflow card slot.
    expect(screen.getByText("Your chapter, in six rooms")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-card")).toBeInTheDocument();
  });

  it("renders nothing extra when no workflow card slot is passed", () => {
    render(<ChapterOSRooms model={model()} />);
    expect(screen.getByText("Your chapter, in six rooms")).toBeInTheDocument();
    expect(screen.queryByTestId("workflow-card")).not.toBeInTheDocument();
  });
});
