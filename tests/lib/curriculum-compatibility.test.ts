import { describe, expect, it } from "vitest";
import { getTemplateSubmissionStatus } from "@/lib/class-template-compat";
import {
  extractRichTextPlainText,
  summarizeRichText,
} from "@/lib/rich-text-summary";

describe("getTemplateSubmissionStatus", () => {
  it("uses workflow status when the workflow columns are available", () => {
    expect(
      getTemplateSubmissionStatus(
        { isPublished: false, submissionStatus: "NEEDS_REVISION" },
        true
      )
    ).toBe("NEEDS_REVISION");
  });

  it("falls back to published/draft when the workflow columns are unavailable", () => {
    expect(
      getTemplateSubmissionStatus(
        { isPublished: true, submissionStatus: "SUBMITTED" },
        false
      )
    ).toBe("APPROVED");

    expect(
      getTemplateSubmissionStatus(
        { isPublished: false, submissionStatus: "APPROVED" },
        false
      )
    ).toBe("DRAFT");
  });
});

describe("rich text summaries", () => {
  it("extracts readable text from stored Tiptap JSON", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          content: [{ type: "text", text: "Course Vision" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Students build a launch plan." }],
        },
      ],
    });

    expect(extractRichTextPlainText(content)).toBe(
      "Course Vision Students build a launch plan."
    );
  });

  it("truncates plain text content without breaking when the value is not JSON", () => {
    expect(summarizeRichText("A very plain description", 12)).toBe(
      "A very plain..."
    );
  });
});
