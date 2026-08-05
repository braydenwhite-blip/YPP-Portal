import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageHelperFab from "@/components/page-helper-fab";

describe("PageHelperFab", () => {
  it("renders nothing (retired for all accounts)", () => {
    const { container } = render(
      <PageHelperFab primaryRole="STUDENT" roles={["STUDENT"]} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
