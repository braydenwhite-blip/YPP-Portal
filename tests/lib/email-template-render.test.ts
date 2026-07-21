import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockSendEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailTemplateOverride: { findUnique: mockFindUnique },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: mockSendEmail,
}));

import {
  resolveTemplate,
  renderEmailTemplate,
  sendTemplatedEmail,
  sendTemplatedEmailWithOverride,
} from "@/lib/email-templates/render";
import { EMAIL_TEMPLATES, sampleVarsFor } from "@/lib/email-templates/registry";

describe("resolveTemplate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("falls back to the registry default when no override exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    const r = await resolveTemplate("application.approved");
    expect(r.source).toBe("default");
    expect(r.subject).toBe(EMAIL_TEMPLATES["application.approved"].defaultSubject);
  });

  it("prefers an active override over the default", async () => {
    mockFindUnique.mockResolvedValue({
      subject: "Custom subject",
      body: "<p>Custom {{applicantName}}</p>",
      isActive: true,
    });
    const r = await resolveTemplate("application.approved");
    expect(r.source).toBe("override");
    expect(r.subject).toBe("Custom subject");
  });

  it("ignores an inactive override", async () => {
    mockFindUnique.mockResolvedValue({
      subject: "Custom",
      body: "x",
      isActive: false,
    });
    const r = await resolveTemplate("application.approved");
    expect(r.source).toBe("default");
  });

  it("falls back to the default when the override lookup throws", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));
    const r = await resolveTemplate("application.rejected");
    expect(r.source).toBe("default");
  });
});

describe("renderEmailTemplate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFindUnique.mockResolvedValue(null);
  });

  it("renders a non-empty subject + shell-wrapped html for every registry key", async () => {
    for (const def of Object.values(EMAIL_TEMPLATES)) {
      const out = await renderEmailTemplate(def.key, sampleVarsFor(def));
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.html).toContain("Youth Passion Project");
      expect(out.html).not.toContain("{{");
    }
  });

  it("renders all three sections of the weekly officer digest", async () => {
    const out = await renderEmailTemplate("action.weekly_people_digest", {
      firstName: "Jordan",
      weekLabel: "Jun 1",
      prioritiesHtml: '<div class="priority-row">Draft Q3 outreach plan</div>',
      congratsHtml: '<div class="congrats-row">Alex Rivera</div>',
      overdueHtml: '<div class="overdue-row">Jordan Lee</div>',
      commandCenterUrl: "https://portal.youthpassionproject.org/work",
    });
    expect(out.html).toContain('<div class="priority-row">Draft Q3 outreach plan</div>');
    expect(out.html).toContain('<div class="congrats-row">Alex Rivera</div>');
    expect(out.html).toContain('<div class="overdue-row">Jordan Lee</div>');
    expect(out.html).toContain("https://portal.youthpassionproject.org/work");
    expect(out.subject).toContain("Jun 1");
  });

  it("HTML-escapes interpolated values", async () => {
    const out = await renderEmailTemplate("application.approved", {
      applicantName: "<script>alert(1)</script>",
      trainingUrl: "https://x.test/t",
    });
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });
});

describe("sendTemplatedEmail / WithOverride", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it("sends the rendered default template", async () => {
    await sendTemplatedEmail("chair_decision.hold", "a@test.com", {
      applicantName: "Jordan",
      statusUrl: "https://x.test/s",
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@test.com",
        subject: EMAIL_TEMPLATES["chair_decision.hold"].defaultSubject,
      })
    );
    const arg = mockSendEmail.mock.calls[0][0];
    expect(arg.html).toContain("Jordan");
  });

  it("sends a one-off override body wrapped in the branded shell", async () => {
    await sendTemplatedEmailWithOverride("a@test.com", {
      subject: "One-off subject",
      bodyHtml: "<p>Custom body</p>",
    });
    const arg = mockSendEmail.mock.calls[0][0];
    expect(arg.subject).toBe("One-off subject");
    expect(arg.html).toContain("<p>Custom body</p>");
    expect(arg.html).toContain("Youth Passion Project");
  });
});
