import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";

describe("ActionCommandBar", () => {
  it("renders the title, subtitle, eyebrow, meta, and primary actions", () => {
    render(
      <ActionCommandBar
        eyebrow="Admin · People Strategy"
        title="Action Tracker"
        subtitle="Every leadership action item."
        meta="12 actions in view · updated Jun 4"
        actions={
          <>
            <a href="/api/admin/actions/export.csv" className="button outline small">
              Export CSV
            </a>
            <a href="/admin/actions/new" className="button small">
              + New Action
            </a>
          </>
        }
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Action Tracker" })).toBeInTheDocument();
    expect(screen.getByText("Every leadership action item.")).toBeInTheDocument();
    expect(screen.getByText("Admin · People Strategy")).toBeInTheDocument();
    expect(screen.getByText("12 actions in view · updated Jun 4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute(
      "href",
      "/api/admin/actions/export.csv"
    );
    expect(screen.getByRole("link", { name: "+ New Action" })).toHaveAttribute(
      "href",
      "/admin/actions/new"
    );
  });

  it("omits optional regions when not provided", () => {
    const { container } = render(<ActionCommandBar title="My Actions" />);

    expect(screen.getByRole("heading", { level: 1, name: "My Actions" })).toBeInTheDocument();
    expect(container.querySelector(".ps-command-eyebrow")).toBeNull();
    expect(container.querySelector(".ps-command-subtitle")).toBeNull();
    expect(container.querySelector(".ps-command-meta")).toBeNull();
    expect(container.querySelector(".ps-command-actions")).toBeNull();
  });
});
