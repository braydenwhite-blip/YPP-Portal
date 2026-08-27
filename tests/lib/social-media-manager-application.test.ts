import { describe, expect, it } from "vitest";

import {
  TECHNOLOGY_MANAGER_KIND,
  LEGACY_SOCIAL_MEDIA_MANAGER_KIND,
  gradeLabel,
  isTechnologyManagerPosition,
  parseTechnologyManagerMetadata,
} from "@/lib/technology-manager-application";
import { socialMediaManagerApplicationSchema } from "@/lib/application-schemas";

describe("technology manager application", () => {
  it("matches the Technology Manager position title (and legacy Social Media title)", () => {
    expect(isTechnologyManagerPosition("Technology Manager")).toBe(true);
    expect(isTechnologyManagerPosition("technology manager")).toBe(true);
    expect(isTechnologyManagerPosition("Social Media Manager")).toBe(true);
    expect(isTechnologyManagerPosition("Social Media Director")).toBe(false);
  });

  it("parses structured application metadata", () => {
    const raw = JSON.stringify({
      kind: TECHNOLOGY_MANAGER_KIND,
      school: "Lincoln High",
      grade: "11",
      platforms: "Portal tools, automations",
      experience: "Built club websites and helped teachers troubleshoot Google Workspace.",
      contentIdeas: "Improve applicant onboarding checklists and admin reporting.",
      weeklyAvailability: "5 hours / week",
      portfolioLinks: "https://github.com/example",
    });

    const parsed = parseTechnologyManagerMetadata(raw);
    expect(parsed?.school).toBe("Lincoln High");
    expect(gradeLabel(parsed!.grade)).toBe("11th grade");
    expect(parsed?.platforms).toContain("automations");
  });

  it("accepts legacy social media metadata kind", () => {
    const raw = JSON.stringify({
      kind: LEGACY_SOCIAL_MEDIA_MANAGER_KIND,
      school: "Lincoln High",
      grade: "11",
      platforms: "Instagram",
      experience: "Ran a school club account.",
      contentIdeas: "Student spotlight series.",
      weeklyAvailability: "4 hrs",
    });
    expect(parseTechnologyManagerMetadata(raw)?.kind).toBe(LEGACY_SOCIAL_MEDIA_MANAGER_KIND);
  });

  it("rejects incomplete metadata", () => {
    expect(parseTechnologyManagerMetadata(JSON.stringify({ kind: TECHNOLOGY_MANAGER_KIND }))).toBeNull();
    expect(parseTechnologyManagerMetadata("not-json")).toBeNull();
  });

  it("validates the portal form schema", () => {
    const ok = socialMediaManagerApplicationSchema.safeParse({
      school: "Lincoln High",
      grade: "10",
      platforms: "Portal tools",
      experience: "I maintain our robotics team website and help teachers with tech setup.",
      whyJoin: "I want to help YPP ship reliable tools for chapters and applicants.",
      contentIdeas: "Better admin dashboards and clearer onboarding checklists.",
      weeklyAvailability: "4–6 hrs",
      resumeUrl: "",
    });
    expect(ok.success).toBe(true);
  });
});
