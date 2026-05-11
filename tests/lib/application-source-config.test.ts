/**
 * Pure-function tests for lib/application-source-config.ts. These are the
 * only tests for that module — no Prisma, no auth, no network.
 */

import { describe, expect, it } from "vitest";
import {
  APPLICATION_SOURCE_CONFIG,
  DEFAULT_EXTERNAL_INTAKE_EMAIL_KINDS,
  buildManualEmailTemplate,
  describeApplicationSource,
  describeManualEmailKind,
  isExternalApplicationSource,
  suggestedEmailKindsForStatus,
} from "@/lib/application-source-config";

describe("describeApplicationSource", () => {
  it("classifies PORTAL as internal", () => {
    expect(isExternalApplicationSource("PORTAL")).toBe(false);
    expect(APPLICATION_SOURCE_CONFIG.PORTAL.isExternal).toBe(false);
  });

  it("classifies GOOGLE_FORMS, CSV_IMPORT, MANUAL_ADMIN_ENTRY as external", () => {
    expect(isExternalApplicationSource("GOOGLE_FORMS")).toBe(true);
    expect(isExternalApplicationSource("CSV_IMPORT")).toBe(true);
    expect(isExternalApplicationSource("MANUAL_ADMIN_ENTRY")).toBe(true);
  });

  it("returns the PORTAL descriptor for unknown sources (defensive)", () => {
    // Cast through unknown so TS lets us pass an invalid value.
    const descriptor = describeApplicationSource(
      "NOT_A_SOURCE" as unknown as Parameters<typeof describeApplicationSource>[0],
    );
    expect(descriptor).toBe(APPLICATION_SOURCE_CONFIG.PORTAL);
  });

  it("never uses the word 'temporary' or 'fake' in descriptors", () => {
    // Product guardrail: external applicants must not be framed as lower-quality.
    for (const descriptor of Object.values(APPLICATION_SOURCE_CONFIG)) {
      expect(descriptor.description.toLowerCase()).not.toMatch(/temporary|fake|workaround|not a real/);
    }
  });
});

describe("describeManualEmailKind", () => {
  it("returns a label + purpose for every known kind", () => {
    const knownKinds = [
      "APPLICATION_CONFIRMATION",
      "INTERVIEW_INVITATION",
      "ACCEPTANCE",
      "REJECTION",
      "WAITLIST",
    ] as const;
    for (const kind of knownKinds) {
      const descriptor = describeManualEmailKind(kind);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.purpose.length).toBeGreaterThan(0);
    }
  });

  it("falls back to GENERAL_FOLLOWUP for unknown kinds", () => {
    const descriptor = describeManualEmailKind(
      "NOT_A_KIND" as unknown as Parameters<typeof describeManualEmailKind>[0],
    );
    expect(descriptor.label).toBe("General follow-up");
  });
});

describe("buildManualEmailTemplate", () => {
  const baseInput = { applicantName: "Ada Lovelace", applicationLabel: "Instructor" };

  it("includes applicant name + role in confirmation subject", () => {
    const tpl = buildManualEmailTemplate("APPLICATION_CONFIRMATION", baseInput);
    expect(tpl.subject).toContain("Instructor");
    expect(tpl.body).toContain("Ada Lovelace");
  });

  it("uses 'there' as fallback greeting when no name is provided", () => {
    const tpl = buildManualEmailTemplate("APPLICATION_CONFIRMATION", {
      applicantName: null,
      applicationLabel: "Instructor",
    });
    expect(tpl.body).toContain("Hi there");
  });

  it("renders chapter name parenthetically when supplied", () => {
    const tpl = buildManualEmailTemplate("ACCEPTANCE", {
      ...baseInput,
      chapterName: "Seattle Chapter",
    });
    expect(tpl.body).toContain("(Seattle Chapter)");
  });

  it("renders interview date + link in confirmation when supplied", () => {
    const tpl = buildManualEmailTemplate("INTERVIEW_CONFIRMATION", {
      ...baseInput,
      interviewDate: "Tue, Jun 3 at 5:00 PM PT",
      interviewLink: "https://meet.example.com/abc",
    });
    expect(tpl.body).toContain("Tue, Jun 3 at 5:00 PM PT");
    expect(tpl.body).toContain("https://meet.example.com/abc");
  });

  it("lists missing items as bullets when provided", () => {
    const tpl = buildManualEmailTemplate("MISSING_INFORMATION_REQUEST", {
      ...baseInput,
      missingItems: ["Resume", "Availability"],
    });
    expect(tpl.body).toContain("• Resume");
    expect(tpl.body).toContain("• Availability");
  });

  it("falls back to a sensible template for unknown kinds (defensive)", () => {
    const tpl = buildManualEmailTemplate(
      "NOT_A_KIND" as unknown as Parameters<typeof buildManualEmailTemplate>[0],
      baseInput,
    );
    expect(tpl.subject.length).toBeGreaterThan(0);
    expect(tpl.body.length).toBeGreaterThan(0);
  });
});

describe("suggestedEmailKindsForStatus", () => {
  it("recommends application confirmation when first submitted", () => {
    const kinds = suggestedEmailKindsForStatus("SUBMITTED");
    expect(kinds).toContain("APPLICATION_CONFIRMATION");
  });

  it("recommends interview invitation when interview is scheduled", () => {
    const kinds = suggestedEmailKindsForStatus("INTERVIEW_SCHEDULED");
    expect(kinds).toContain("INTERVIEW_INVITATION");
  });

  it("recommends acceptance after APPROVED", () => {
    const kinds = suggestedEmailKindsForStatus("APPROVED");
    expect(kinds).toContain("ACCEPTANCE");
  });

  it("recommends rejection after REJECTED", () => {
    const kinds = suggestedEmailKindsForStatus("REJECTED");
    expect(kinds).toContain("REJECTION");
  });

  it("returns a general follow-up for an unknown status", () => {
    const kinds = suggestedEmailKindsForStatus("WAT");
    expect(kinds).toEqual(["GENERAL_FOLLOWUP"]);
  });
});

describe("DEFAULT_EXTERNAL_INTAKE_EMAIL_KINDS", () => {
  it("starts with the application confirmation email", () => {
    expect(DEFAULT_EXTERNAL_INTAKE_EMAIL_KINDS[0]).toBe("APPLICATION_CONFIRMATION");
  });
});
