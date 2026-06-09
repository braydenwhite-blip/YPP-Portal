import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveStrategicEntityContext } from "@/lib/people-strategy/strategic-entity-context";
import { StrategicEntityPanel } from "@/components/people-strategy/strategic-entity-panel";

import { action, NOW } from "../lib/strategic-helpers";

describe("StrategicEntityPanel", () => {
  it("shows the strategic projects + initiatives a connected entity serves", () => {
    const context = deriveStrategicEntityContext({
      actions: [
        action({ id: "a1", title: "Sign the Beth El pilot camp agreement", goalCategory: "Summer Camps" }),
      ],
      now: NOW,
    });
    render(<StrategicEntityPanel context={context} />);
    expect(screen.getByText("Strategic context")).toBeInTheDocument();
    expect(screen.getByText("Strategic projects")).toBeInTheDocument();
  });

  it("renders nothing for a non-strategic entity, keeping the page clean", () => {
    const context = deriveStrategicEntityContext({
      actions: [action({ id: "a1", title: "Order more pencils for the supply closet" })],
      now: NOW,
    });
    const { container } = render(<StrategicEntityPanel context={context} />);
    expect(container).toBeEmptyDOMElement();
  });
});
