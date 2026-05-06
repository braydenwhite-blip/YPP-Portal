/**
 * RoomMeters — flash + level state tests.
 *
 * Asserts that the meter rows pick up the right `data-flash` and
 * `data-state` attributes when the state moves, including the new
 * "strong" shimmer for big swings and the critical/hot level pulse.
 */

import { render, rerender as _rerender } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { RoomMeters } from "@/components/training/journey/RoomMeters";

afterEach(() => {
  vi.useRealTimers();
});

function row(container: HTMLElement, label: string): HTMLElement {
  const row = container.querySelector(`[aria-label^="${label}"]`);
  if (!row) throw new Error(`row not found for label "${label}"`);
  return row as HTMLElement;
}

describe("RoomMeters — flash + level state", () => {
  it("renders nothing when not active", () => {
    const { container } = render(
      <RoomMeters
        state={{ engagement: 60, clarity: 70, energy: 60 }}
        active={false}
      />
    );
    expect(container.querySelector(".room-meters")).toBeNull();
  });

  it("flags the row as 'up' on a small upward delta", () => {
    const { rerender, container } = render(
      <RoomMeters
        state={{ engagement: 60, clarity: 70, energy: 60 }}
        active={true}
      />
    );

    rerender(
      <RoomMeters
        state={{ engagement: 64, clarity: 70, energy: 60 }}
        active={true}
      />
    );

    expect(row(container, "Engagement").getAttribute("data-flash")).toBe("up");
  });

  it("flags the row as 'up-strong' on a ≥12pt upward swing", () => {
    const { rerender, container } = render(
      <RoomMeters
        state={{ engagement: 60, clarity: 70, energy: 60 }}
        active={true}
      />
    );

    rerender(
      <RoomMeters
        state={{ engagement: 80, clarity: 70, energy: 60 }}
        active={true}
      />
    );

    expect(row(container, "Engagement").getAttribute("data-flash")).toBe("up-strong");
  });

  it("flags the row as 'down-strong' on a ≥12pt downward swing", () => {
    const { rerender, container } = render(
      <RoomMeters
        state={{ engagement: 80, clarity: 70, energy: 60 }}
        active={true}
      />
    );

    rerender(
      <RoomMeters
        state={{ engagement: 50, clarity: 70, energy: 60 }}
        active={true}
      />
    );

    expect(row(container, "Engagement").getAttribute("data-flash")).toBe("down-strong");
  });

  it("marks the row as critical when value < 25", () => {
    const { container } = render(
      <RoomMeters
        state={{ engagement: 20, clarity: 70, energy: 60 }}
        active={true}
      />
    );
    expect(row(container, "Engagement").getAttribute("data-state")).toBe("critical");
    expect(row(container, "Clarity").getAttribute("data-state")).toBeNull();
  });

  it("marks the row as hot when value > 90", () => {
    const { container } = render(
      <RoomMeters
        state={{ engagement: 60, clarity: 70, energy: 95 }}
        active={true}
      />
    );
    expect(row(container, "Energy").getAttribute("data-state")).toBe("hot");
  });
});
