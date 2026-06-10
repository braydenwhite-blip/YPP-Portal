import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import ActionItemForm from "@/components/people-strategy/action-item-form";

// MotionArea reads prefers-reduced-motion via matchMedia, which jsdom lacks.
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

const USERS = [
  { id: "u1", name: "Alice", email: "alice@x.org" },
  { id: "u2", name: "Bob", email: "bob@x.org" },
];

describe("ActionItemForm — Action 4.0 creation surface", () => {
  it("renders the source + strategic context chips and a project-aware CTA", () => {
    render(
      <ActionItemForm
        users={USERS}
        departments={[]}
        currentUserId="u1"
        initial={{
          title: "Confirm the Beth El venue contract",
          successDefinition: "Signed contract on file",
          sourceType: "PROJECT",
          sourceLabel: "From a project",
          strategicProjectId: "beth-el-pilot",
          strategicInitiativeId: "summer-camps-2026",
          strategicLinkLabel: "Summer Camps 2026 › Beth El Pilot",
        }}
      />
    );

    expect(screen.getByText("From a project")).toBeInTheDocument();
    expect(screen.getByText("Summer Camps 2026 › Beth El Pilot")).toBeInTheDocument();
    // Context-aware CTA, never a generic "Submit"/"Create action".
    expect(
      screen.getByRole("button", { name: "Save project action" })
    ).toBeInTheDocument();
    // Next-step / definition-of-done field is present.
    expect(screen.getByLabelText(/definition of done/i)).toBeInTheDocument();
  });

  it("uses a follow-up CTA for a follow-up action", () => {
    render(
      <ActionItemForm
        users={USERS}
        departments={[]}
        currentUserId="u1"
        initial={{ title: "Follow-up: call the vendor back", sourceType: "FOLLOW_UP", sourceActionId: "act_1" }}
      />
    );
    expect(screen.getByRole("button", { name: "Create follow-up" })).toBeInTheDocument();
  });

  it("renders the simplified five-step creation sections", () => {
    render(<ActionItemForm users={USERS} departments={[]} currentUserId="u1" />);
    expect(screen.getByText("1. What needs to happen?")).toBeInTheDocument();
    expect(screen.getByText("2. Who owns it?")).toBeInTheDocument();
    expect(screen.getByText("3. When is it due?")).toBeInTheDocument();
    expect(screen.getByText("4. Where did this come from?")).toBeInTheDocument();
    expect(screen.getByText("5. What context matters?")).toBeInTheDocument();
  });

  it("surfaces live quality warnings for a weak draft", () => {
    // No assignable users → no owner can be defaulted → NEEDS_OWNER fires.
    render(
      <ActionItemForm users={[]} departments={[]} currentUserId="nobody" initial={{ title: "" }} />
    );
    expect(
      screen.getByText("No owner yet — this will disappear unless someone owns it.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Define what done means before assigning.")
    ).toBeInTheDocument();
  });
});
