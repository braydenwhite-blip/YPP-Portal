import { beforeEach, describe, expect, it, vi } from "vitest";

const validateTwilioWebhookRequest = vi.fn();
const handleTwilioStatusCallback = vi.fn();

vi.mock("@/lib/sms", () => ({
  validateTwilioWebhookRequest,
}));

vi.mock("@/lib/notification-delivery", () => ({
  handleTwilioStatusCallback,
}));

describe("Twilio status webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    validateTwilioWebhookRequest.mockReset();
    handleTwilioStatusCallback.mockReset();
    process.env.TWILIO_AUTH_TOKEN = "twilio-secret";
  });

  it("passes valid status callbacks to the delivery handler", async () => {
    validateTwilioWebhookRequest.mockReturnValue(true);
    handleTwilioStatusCallback.mockResolvedValue({ updated: true });

    const { POST } = await import("@/app/api/twilio/status/route");
    const response = await POST(
      new Request("https://portal.example.com/api/twilio/status", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": "valid-signature",
        },
        body: new URLSearchParams({
          MessageSid: "SM123",
          MessageStatus: "delivered",
          To: "+14155552671",
        }),
      })
    );

    expect(handleTwilioStatusCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        MessageSid: "SM123",
        MessageStatus: "delivered",
      })
    );
    expect(response.status).toBe(200);
  });

  it("rejects invalid webhook signatures", async () => {
    validateTwilioWebhookRequest.mockReturnValue(false);

    const { POST } = await import("@/app/api/twilio/status/route");
    const response = await POST(
      new Request("https://portal.example.com/api/twilio/status", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": "bad-signature",
        },
        body: new URLSearchParams({
          MessageSid: "SM123",
          MessageStatus: "failed",
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(handleTwilioStatusCallback).not.toHaveBeenCalled();
  });
});
