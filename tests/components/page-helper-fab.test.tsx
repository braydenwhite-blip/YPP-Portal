import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PageHelperFab from "@/components/page-helper-fab";

const mockedUsePathname = vi.mocked(usePathname);

describe("PageHelperFab", () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue("/messages");
  });

  it("starts collapsed and opens when the button is pressed", () => {
    render(<PageHelperFab primaryRole="STUDENT" roles={["STUDENT"]} />);

    expect(screen.queryByRole("dialog", { name: "Messages" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open page help" }));

    expect(screen.getByRole("dialog", { name: "Messages" })).toBeInTheDocument();
    expect(screen.getByText("What this page is for")).toBeInTheDocument();
  });

  it("closes when escape is pressed", () => {
    render(<PageHelperFab primaryRole="STUDENT" roles={["STUDENT"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open page help" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Messages" })).not.toBeInTheDocument();
  });

  it("closes when the user clicks outside the panel", () => {
    render(<PageHelperFab primaryRole="STUDENT" roles={["STUDENT"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open page help" }));
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("dialog", { name: "Messages" })).not.toBeInTheDocument();
  });

  it("returns nothing for hidden routes", () => {
    mockedUsePathname.mockReturnValue("/instructor/lesson-design-studio/print");

    const { container } = render(
      <PageHelperFab primaryRole="INSTRUCTOR" roles={["INSTRUCTOR"]} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("uses the configured alternate placement when a route asks for it", () => {
    mockedUsePathname.mockReturnValue("/world");

    render(<PageHelperFab primaryRole="STUDENT" roles={["STUDENT"]} />);

    expect(screen.getByRole("button", { name: "Open page help" }).parentElement).toHaveAttribute(
      "data-page-helper-placement",
      "bottom-left"
    );
  });
});
