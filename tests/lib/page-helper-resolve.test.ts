import { describe, expect, it } from "vitest";
import { resolvePageHelper } from "@/lib/page-helper/resolve";

describe("resolvePageHelper", () => {
  it("resolves static routes with the migrated copy", () => {
    const result = resolvePageHelper({
      pathname: "/messages",
      primaryRole: "STUDENT",
      roles: ["STUDENT"],
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Messages");
    expect(result?.content.purpose).toContain("direct-message inbox");
    expect(result?.hidden).toBe(false);
    expect(result?.placement).toBe("bottom-right");
  });

  it("matches dynamic routes against the registry", () => {
    const result = resolvePageHelper({
      pathname: "/messages/abc123",
      primaryRole: "STUDENT",
      roles: ["STUDENT"],
    });

    expect(result?.pattern).toBe("/messages/[conversationId]");
    expect(result?.title).toBe("Message Details");
  });

  it("applies role-specific overrides when they exist", () => {
    const result = resolvePageHelper({
      pathname: "/",
      primaryRole: "ADMIN",
      roles: ["ADMIN"],
    });

    expect(result?.content.purpose).toContain("admin command center");
  });

  it("returns public help for public routes", () => {
    const result = resolvePageHelper({
      pathname: "/login",
      primaryRole: "PUBLIC",
      roles: [],
    });

    expect(result?.title).toBe("Login");
    expect(result?.content.firstStep).toContain("email and password");
  });

  it("supports explicit hidden and placement exceptions", () => {
    const hiddenResult = resolvePageHelper({
      pathname: "/instructor/lesson-design-studio/print",
      primaryRole: "INSTRUCTOR",
      roles: ["INSTRUCTOR"],
    });
    const movedResult = resolvePageHelper({
      pathname: "/world",
      primaryRole: "STUDENT",
      roles: ["STUDENT"],
    });

    expect(hiddenResult?.hidden).toBe(true);
    expect(movedResult?.placement).toBe("bottom-left");
  });

  it("returns null for unknown paths", () => {
    const result = resolvePageHelper({
      pathname: "/totally-unknown-page",
      primaryRole: "PUBLIC",
      roles: [],
    });

    expect(result).toBeNull();
  });
});
