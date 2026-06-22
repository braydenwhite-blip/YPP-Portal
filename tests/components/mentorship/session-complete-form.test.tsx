import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The form only references the server action; mock it so the test doesn't pull
// in the server-action module (and its Prisma graph) just to render.
vi.mock("@/lib/mentorship-hub-actions", () => ({
  completeMentorshipSession: vi.fn(),
}));

import { SessionCompleteForm } from "@/app/(app)/mentorship/_components/session-complete-form";

describe("SessionCompleteForm", () => {
  function renderForm() {
    render(
      <SessionCompleteForm
        sessionId="s1"
        menteeId="u-mentee"
        menteeName="Sam Mentee"
        mentorUserId="u-mentor"
        sessionTitle="April check-in"
        menteeAttended
      />
    );
  }

  it("offers a private recap and an optional one-commitment close", () => {
    renderForm();
    expect(
      screen.getByPlaceholderText(/the mentee won't see this/i)
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/single next step from this session/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark complete/ })).toBeInTheDocument();
  });

  it("lets the commitment be owned by the mentee, the mentor, or shared", () => {
    renderForm();
    expect(screen.getByRole("option", { name: "Sam Mentee" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Me (mentor)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Shared" })).toBeInTheDocument();
  });
});
