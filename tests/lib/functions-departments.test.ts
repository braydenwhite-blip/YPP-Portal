import { describe, expect, it } from "vitest";

import { formatFunctionDepartment } from "@/lib/org/functions-departments";

describe("formatFunctionDepartment", () => {
  it("keeps Function and Department as separate labels", () => {
    expect(
      formatFunctionDepartment({
        functionName: "Operations",
        departmentName: "Technology",
      })
    ).toEqual({
      functionLabel: "Operations",
      departmentLabel: "Technology",
      summary: "Operations · Technology",
    });
  });

  it("never dash-joins Function and Department", () => {
    const formatted = formatFunctionDepartment({
      functionName: "Operations",
      departmentName: "Technology",
    });
    expect(formatted.summary).not.toContain(" - ");
    expect(formatted.summary).not.toContain("Operations - Technology");
  });
});
