import { describe, expect, it } from "vitest";

import {
  SOCIAL_MEDIA_MANAGER_KIND,
  gradeLabel,
  isSocialMediaManagerPosition,
  parseSocialMediaManagerMetadata,
} from "@/lib/social-media-manager-application";
import { socialMediaManagerApplicationSchema } from "@/lib/application-schemas";

describe("social media manager application", () => {
  it("matches the Social Media Manager position title only", () => {
    expect(isSocialMediaManagerPosition("Social Media Manager")).toBe(true);
    expect(isSocialMediaManagerPosition("Technology Manager")).toBe(false);
    expect(isSocialMediaManagerPosition("Social Media Director")).toBe(false);
  });

  it("parses structured application metadata", () => {
    const raw = JSON.stringify({
      kind: SOCIAL_MEDIA_MANAGER_KIND,
      school: "Lincoln High",
      grade: "11",
      platforms: "Instagram, TikTok",
      experience: "I run a school club account and edit Reels weekly for our newspaper.",
      contentIdeas: "A weekly ‘student passion spotlight’ series with short interview clips.",
      weeklyAvailability: "5 hours / week",
      portfolioLinks: "https://instagram.com/example",
    });

    const parsed = parseSocialMediaManagerMetadata(raw);
    expect(parsed?.school).toBe("Lincoln High");
    expect(gradeLabel(parsed!.grade)).toBe("11th grade");
    expect(parsed?.platforms).toContain("TikTok");
  });

  it("rejects incomplete metadata", () => {
    expect(parseSocialMediaManagerMetadata(JSON.stringify({ kind: SOCIAL_MEDIA_MANAGER_KIND }))).toBeNull();
    expect(parseSocialMediaManagerMetadata("not-json")).toBeNull();
  });

  it("validates the portal form schema", () => {
    const ok = socialMediaManagerApplicationSchema.safeParse({
      school: "Lincoln High",
      grade: "10",
      platforms: "Instagram",
      experience: "I create Instagram carousels for my robotics team and reply to DMs.",
      whyJoin: "I want to help YPP reach more students with clear, fun stories about our classes.",
      contentIdeas: "Behind-the-scenes of a first class, plus a TikTok trend remixed with YPP branding.",
      weeklyAvailability: "4–6 hrs",
      resumeUrl: "",
    });
    expect(ok.success).toBe(true);

    const bad = socialMediaManagerApplicationSchema.safeParse({
      school: "A",
      grade: "8",
      platforms: "",
      experience: "short",
      whyJoin: "short",
      contentIdeas: "x",
      weeklyAvailability: "",
    });
    expect(bad.success).toBe(false);
  });
});
