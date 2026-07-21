import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resendSend: vi.fn(),
  userFindUnique: vi.fn(),
  applicationFindUnique: vi.fn(),
  getBaseUrl: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return {
    emails: {
      send: mocks.resendSend,
    },
    };
  }),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    instructorApplication: {
      findUnique: mocks.applicationFindUnique,
    },
  },
}));

vi.mock("@/lib/portal-auth-utils", () => ({
  getBaseUrl: mocks.getBaseUrl,
}));

describe("Instructor applicant email links", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "Youth Passion Project <noreply@example.com>";
    mocks.resendSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
    mocks.getBaseUrl.mockResolvedValue("https://demo.youthpassionproject.org");
    mocks.userFindUnique.mockResolvedValue({ name: "Morgan", email: "morgan@example.com" });
    mocks.applicationFindUnique.mockResolvedValue({
      applicant: { name: "Ada Applicant", email: "ada@example.com" },
    });
  });

  it("uses resolved absolute links for reviewer and interviewer assignment emails", async () => {
    const { sendReviewerAssignedEmail, sendInterviewerAssignedEmail } = await import("@/lib/email");

    await sendReviewerAssignedEmail("reviewer-1", "app-1");
    await sendInterviewerAssignedEmail("interviewer-1", "app-1", "LEAD");

    const reviewerHtml = String(mocks.resendSend.mock.calls[0][0].html);
    const interviewerHtml = String(mocks.resendSend.mock.calls[1][0].html);

    expect(reviewerHtml).toContain("https://demo.youthpassionproject.org/applications/instructor/app-1");
    expect(interviewerHtml).toContain("https://demo.youthpassionproject.org/applications/instructor/app-1/interview");
    expect(reviewerHtml).not.toContain("[object Promise]");
    expect(interviewerHtml).not.toContain("[object Promise]");
  });

  it("renders mailto links for the weekly officer digest's congrats and overdue people", async () => {
    const { sendWeeklyOfficerDigestEmail } = await import("@/lib/email");

    await sendWeeklyOfficerDigestEmail({
      to: "officer@example.com",
      recipientName: "Officer",
      weekLabel: "Jun 1",
      priorities: [
        {
          title: "Draft Q3 outreach plan",
          reason: "Overdue 3 days",
          ownerName: "Alex Rivera",
          departmentName: "Outreach",
          dueLabel: "May 29",
          actionUrl: "https://portal.youthpassionproject.org/actions/1",
        },
      ],
      congrats: [
        { name: "Alex Rivera", email: "alex@example.com", reasons: ["2 completed actions this week"] },
      ],
      overdue: [
        {
          name: "Jordan Lee",
          email: "jordan@example.com",
          tasks: [{ title: "Submit expense report", dueLabel: "May 30", source: "Weekly impact" }],
        },
      ],
      commandCenterUrl: "https://portal.youthpassionproject.org/work",
    });

    const html = String(mocks.resendSend.mock.calls[0][0].html);
    expect(html).toContain('href="mailto:alex@example.com"');
    expect(html).toContain('href="mailto:jordan@example.com"');
    expect(html).toContain("https://portal.youthpassionproject.org/actions/1");
    expect(html).not.toContain("[object Promise]");
  });

  it("uses resolved absolute links for chair emails", async () => {
    const { sendChairDecisionEmail, sendChairDigestEmail } = await import("@/lib/email");

    await sendChairDecisionEmail("ada@example.com", "app-1", "HOLD");
    await sendChairDigestEmail("chair@example.com", "Morgan", 1, [
      { applicantName: "Ada Applicant", queuedDaysAgo: 2 },
    ]);

    const decisionHtml = String(mocks.resendSend.mock.calls[0][0].html);
    const digestHtml = String(mocks.resendSend.mock.calls[1][0].html);

    expect(decisionHtml).toContain("https://demo.youthpassionproject.org/application-status");
    expect(digestHtml).toContain("https://demo.youthpassionproject.org/admin/instructor-applicants/chair-queue");
    expect(decisionHtml).not.toContain("[object Promise]");
    expect(digestHtml).not.toContain("[object Promise]");
  });
});
