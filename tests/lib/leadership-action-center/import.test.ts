import { describe, expect, it } from "vitest";

import {
  findDuplicateRows,
  parseSpreadsheetInput,
} from "@/lib/leadership-action-center/import";

const SAMPLE_TSV = `Category\tItem\tDeadline\tPrimary Owners\tGet Input From\tStatus\tNeeds Officer Discussion?
Communication\tEmail summer camps\t2026-05-15\tBrayden\tAnthea\tIn Progress\tNo
Pink\tFinalize interview questions\t2026-05-16\tHiring chair\t\tNot Started\tYes
Tech\tFix portal bug\t\tBrayden\t\tBlocked\tNo
Staff Management\t\t2026-05-20\t\t\tNot Started\tNo`;

describe("parseSpreadsheetInput", () => {
  it("parses tab-delimited rows and infers the column map", () => {
    const result = parseSpreadsheetInput(SAMPLE_TSV);
    expect(result.headers.length).toBeGreaterThan(0);
    expect(result.columnMap.title).toBe("Item");
    expect(result.columnMap.dueDate).toBe("Deadline");
    expect(result.columnMap.primaryOwner).toBe("Primary Owners");
    expect(result.columnMap.inputNeeded).toBe("Get Input From");
    expect(result.columnMap.needsOfficerDiscussion).toBe("Needs Officer Discussion?");
  });

  it("normalizes color names + status synonyms", () => {
    const result = parseSpreadsheetInput(SAMPLE_TSV);
    const titles = result.rows.map((r) => r.title);
    expect(titles).toContain("Email summer camps");

    const finalize = result.rows.find((r) => r.title === "Finalize interview questions");
    expect(finalize?.category).toBe("INSTRUCTION"); // "Pink" → INSTRUCTION
    expect(finalize?.needsOfficerDiscussion).toBe(true);

    const portal = result.rows.find((r) => r.title === "Fix portal bug");
    expect(portal?.category).toBe("TECHNOLOGY"); // "Tech" → TECHNOLOGY
    expect(portal?.status).toBe("BLOCKED");
    expect(portal?.dueDate).toBeNull();
  });

  it("flags rows with no title as skipped", () => {
    const result = parseSpreadsheetInput(SAMPLE_TSV);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].rowNumber).toBe(5);
  });

  it("parses CSV format with quoted commas", () => {
    const csv = `Item,Category,Status\n"Send email, again",Communication,In Progress\nFix bug,Tech,Done`;
    const result = parseSpreadsheetInput(csv);
    expect(result.rows[0].title).toBe("Send email, again");
    expect(result.rows[1].status).toBe("COMPLETE");
  });
});

describe("findDuplicateRows", () => {
  it("matches by title + category + due date", () => {
    const result = parseSpreadsheetInput(SAMPLE_TSV);
    const duplicates = findDuplicateRows(result.rows, [
      { title: "Email summer camps", category: "COMMUNICATION", dueDate: new Date(2026, 4, 15) },
    ]);
    expect(duplicates.size).toBe(1);
  });

  it("does not match when titles differ", () => {
    const result = parseSpreadsheetInput(SAMPLE_TSV);
    const duplicates = findDuplicateRows(result.rows, [
      { title: "Some other thing", category: "COMMUNICATION", dueDate: null },
    ]);
    expect(duplicates.size).toBe(0);
  });
});
