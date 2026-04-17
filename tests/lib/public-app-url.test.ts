import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicAppUrl, toAbsoluteAppUrl } from "@/lib/public-app-url";

describe("public-app-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes bare public hostnames into absolute https URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "youthpassionproject-portal.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    expect(getPublicAppUrl()).toBe("https://youthpassionproject-portal.vercel.app");
    expect(toAbsoluteAppUrl("/mentorship-program/schedule")).toBe(
      "https://youthpassionproject-portal.vercel.app/mentorship-program/schedule"
    );
  });

  it("keeps loopback fallback URLs on http for local development", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "localhost:3000");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    expect(getPublicAppUrl()).toBe("http://localhost:3000");
    expect(toAbsoluteAppUrl("/my-program/schedule")).toBe(
      "http://localhost:3000/my-program/schedule"
    );
  });
});
