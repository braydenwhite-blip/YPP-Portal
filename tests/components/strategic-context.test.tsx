import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveStrategicContextForMeeting } from "@/lib/people-strategy/strategic-context";
import { StrategicContextSection } from "@/components/people-strategy/strategic-context";

describe("StrategicContextSection (meeting)", () => {
  it("frames an inferred meeting link honestly as 'likely relates to'", () => {
    const context = deriveStrategicContextForMeeting({ title: "Beth El pilot camp planning sync" });
    expect(context.isStrategic).toBe(true);
    render(<StrategicContextSection context={context} kind="meeting" showEmptyState />);
    expect(screen.getByText(/likely relates to/)).toBeInTheDocument();
  });

  it("shows a helpful empty state for an unconnected meeting", () => {
    const context = deriveStrategicContextForMeeting({ title: "Order pencils for the supply closet" });
    expect(context.isStrategic).toBe(false);
    render(<StrategicContextSection context={context} kind="meeting" showEmptyState />);
    expect(screen.getByText(/isn't connected to a strategic project yet/)).toBeInTheDocument();
  });

  it("renders nothing when not strategic and no empty state is requested", () => {
    const context = deriveStrategicContextForMeeting({ title: "Order pencils for the supply closet" });
    const { container } = render(<StrategicContextSection context={context} kind="action" />);
    expect(container).toBeEmptyDOMElement();
  });
});
