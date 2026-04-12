import { beforeEach, describe, expect, it, vi } from "vitest";

const messagesCreate = vi.fn();
const validateRequest = vi.fn();
const twilioFactory = Object.assign(
  vi.fn(() => ({
    messages: {
      create: messagesCreate,
    },
  })),
  { validateRequest }
);

vi.mock("twilio", () => ({
  default: twilioFactory,
}));

describe("lib/sms", () => {
  beforeEach(() => {
    vi.resetModules();
    messagesCreate.mockReset();
    validateRequest.mockReset();

    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    delete process.env.TWILIO_FROM_NUMBER;

    process.env.NEXTAUTH_URL = "https://portal.example.com";
  });

  it("reports when SMS is not configured", async () => {
    const { isSmsConfigured } = await import("@/lib/sms");

    expect(isSmsConfigured()).toBe(false);
  });

  it("sends SMS through the configured messaging service with an absolute portal link", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG123";
    messagesCreate.mockResolvedValue({ sid: "SM123" });

    const { sendSmsNotification } = await import("@/lib/sms");
    const result = await sendSmsNotification({
      to: "+14155552671",
      title: "Interview booked",
      body: "Your interview is confirmed.",
      link: "/interviews/schedule",
    });

    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+14155552671",
        messagingServiceSid: "MG123",
        statusCallback: "https://portal.example.com/api/twilio/status",
        body: expect.stringContaining("https://portal.example.com/interviews/schedule"),
      })
    );
    expect(result).toEqual({
      success: true,
      sid: "SM123",
    });
  });

  it("returns a failure result when Twilio rejects the send", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG123";
    messagesCreate.mockRejectedValue(new Error("Twilio rejected the request"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { sendSmsNotification } = await import("@/lib/sms");
    const result = await sendSmsNotification({
      to: "+14155552671",
      title: "System alert",
      body: "Something happened.",
      link: "/notifications",
    });

    expect(result).toEqual({
      success: false,
      error: "Twilio rejected the request",
    });
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
