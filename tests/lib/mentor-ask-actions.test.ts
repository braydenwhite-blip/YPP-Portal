import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";
import { submitMentorQuestion } from "@/lib/mentor-ask-actions";
import { createMentorshipRequest } from "@/lib/mentorship-hub-actions";

vi.mock("@/lib/mentorship-hub-actions", () => ({
  createMentorshipRequest: vi.fn(),
  markMentorshipResponseHelpful: vi.fn(),
  respondToMentorshipRequest: vi.fn(),
}));

describe("mentor-ask-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "student-1",
        roles: ["STUDENT"],
      },
    } as any);
    vi.mocked(createMentorshipRequest).mockResolvedValue({ id: "request-1" } as any);
  });

  it("passes the anonymous toggle through to the mentorship request", async () => {
    const formData = new FormData();
    formData.set("question", "How do I improve my portfolio?");
    formData.set("passionId", "coding");
    formData.set("isAnonymous", "on");

    await submitMentorQuestion(formData);

    const requestFormData = vi.mocked(createMentorshipRequest).mock.calls[0]?.[0] as FormData;
    expect(requestFormData.get("kind")).toBe("GENERAL_QNA");
    expect(requestFormData.get("visibility")).toBe("PUBLIC");
    expect(requestFormData.get("question")).toBe(
      "How do I improve my portfolio?"
    );
    expect(requestFormData.get("isAnonymous")).toBe("true");
  });
});
