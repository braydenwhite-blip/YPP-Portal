import { describe, expect, it } from "vitest";

import {
  formatApplicantDisplayName,
  isApplicantLastNameMissing,
} from "@/lib/applicant-display-name";

describe("formatApplicantDisplayName", () => {
  it("prefers preferred first name plus explicit last name", () => {
    expect(
      formatApplicantDisplayName({
        preferredFirstName: "Ada",
        lastName: "Lovelace",
        legalName: "Augusta Ada King",
        applicant: { name: "Ada" },
      })
    ).toBe("Ada Lovelace");
  });

  it("falls back to legal or account names for legacy rows", () => {
    expect(
      formatApplicantDisplayName({
        preferredFirstName: "Ada",
        legalName: "Ada Lovelace",
        applicant: { name: "Ada" },
      })
    ).toBe("Ada Lovelace");

    expect(
      formatApplicantDisplayName({
        applicant: { name: "Grace Hopper", email: "grace@example.com" },
      })
    ).toBe("Grace Hopper");
  });
});

describe("isApplicantLastNameMissing", () => {
  it("treats blank and null last names as missing", () => {
    expect(isApplicantLastNameMissing({ lastName: null })).toBe(true);
    expect(isApplicantLastNameMissing({ lastName: "  " })).toBe(true);
    expect(isApplicantLastNameMissing({ lastName: "Hopper" })).toBe(false);
  });
});
