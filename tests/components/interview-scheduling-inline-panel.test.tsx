import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewSchedulingInlinePanel from "@/components/instructor-applicants/InterviewSchedulingInlinePanel";
import { offerInterviewSlots } from "@/lib/instructor-application-actions";

vi.mock("@/lib/instructor-application-actions", () => ({
  offerInterviewSlots: vi.fn(),
}));

function futureLocalDateTime(offsetDays: number) {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    value.getFullYear(),
    "-",
    pad(value.getMonth() + 1),
    "-",
    pad(value.getDate()),
    "T",
    pad(value.getHours()),
    ":",
    pad(value.getMinutes()),
  ].join("");
}

describe("InterviewSchedulingInlinePanel", () => {
  beforeEach(() => {
    vi.mocked(offerInterviewSlots).mockReset();
  });

  it("describes the automatic 3-time email flow", () => {
    render(
      <InterviewSchedulingInlinePanel
        applicationId="app-1"
        offeredSlots={[]}
        availabilityWindows={[]}
        canPostSlots
      />
    );

    expect(screen.getByText("Automatic applicant email")).toBeInTheDocument();
    expect(screen.getByText(/exactly 3 future options/i)).toBeInTheDocument();
    expect(screen.queryByText(/manual offer/i)).not.toBeInTheDocument();
  });

  it("emails exactly 3 proposed times with plain-text meeting details", async () => {
    vi.mocked(offerInterviewSlots).mockResolvedValue({ success: true });

    render(
      <InterviewSchedulingInlinePanel
        applicationId="app-1"
        offeredSlots={[]}
        availabilityWindows={[]}
        canPostSlots
      />
    );

    fireEvent.change(screen.getByLabelText("Meeting details"), {
      target: { value: "Room 204" },
    });
    fireEvent.change(screen.getByLabelText("Option 1"), {
      target: { value: futureLocalDateTime(2) },
    });
    fireEvent.change(screen.getByLabelText("Option 2"), {
      target: { value: futureLocalDateTime(3) },
    });
    fireEvent.change(screen.getByLabelText("Option 3"), {
      target: { value: futureLocalDateTime(4) },
    });

    fireEvent.click(screen.getByRole("button", { name: "Email times" }));

    await waitFor(() => {
      expect(offerInterviewSlots).toHaveBeenCalledWith(
        "app-1",
        expect.arrayContaining([
          expect.objectContaining({ meetingUrl: "Room 204" }),
        ])
      );
    });
    expect(screen.getByText(/applicant can now pick one/i)).toBeInTheDocument();
  });
});
