import { beforeEach, describe, expect, it, vi } from "vitest";

const validateTwilioWebhookRequest = vi.fn();
const normalizePhoneNumberToE164 = vi.fn();

vi.mock("@/lib/sms", () => ({
  validateTwilioWebhookRequest,
  normalizePhoneNumberToE164,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationPreference: {
      updateMany: vi.fn(),
    },
  },
}));

describe("Twilio inbound webhook", () => {
  beforeEach(async () => {
    vi.resetModules();
    validateTwilioWebhookRequest.mockReset();
    normalizePhoneNumberToE164.mockReset();
    process.env.TWILIO_AUTH_TOKEN = "twilio-secret";

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).notificationPreference.updateMany.mockReset();
  });

  it("disables SMS when a valid STOP webhook arrives", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    validateTwilioWebhookRequest.mockReturnValue(true);
    normalizePhoneNumberToE164.mockReturnValue("+14155552671");
    prismaMock.notificationPreference.updateMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("@/app/api/twilio/inbound/route");
    const response = await POST(
      new Request("https://portal.example.com/api/twilio/inbound", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": "valid-signature",
        },
        body: new URLSearchParams({
          From: "+1 (415) 555-2671",
          Body: "STOP",
          OptOutType: "STOP",
        }),
      })
    );

    expect(prismaMock.notificationPreference.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { smsPhoneE164: "+14155552671" },
        data: expect.objectContaining({
          smsEnabled: false,
          smsOptOutAt: expect.any(Date),
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<Response></Response>");
  });

  it("rejects inbound webhooks with an invalid signature", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    validateTwilioWebhookRequest.mockReturnValue(false);

    const { POST } = await import("@/app/api/twilio/inbound/route");
    const response = await POST(
      new Request("https://portal.example.com/api/twilio/inbound", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": "bad-signature",
        },
        body: new URLSearchParams({
          From: "+14155552671",
          Body: "STOP",
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(prismaMock.notificationPreference.updateMany).not.toHaveBeenCalled();
  });
});
