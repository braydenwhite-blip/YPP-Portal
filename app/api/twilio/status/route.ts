import { NextResponse } from "next/server";
import { handleTwilioStatusCallback } from "@/lib/notification-delivery";
import { validateTwilioWebhookRequest } from "@/lib/sms";

function toParams(formData: FormData) {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  );
}

export async function POST(request: Request) {
  if (!process.env.TWILIO_AUTH_TOKEN?.trim()) {
    return NextResponse.json({ error: "Twilio webhook auth is not configured." }, { status: 500 });
  }

  const formData = await request.formData();
  const params = toParams(formData);

  if (!validateTwilioWebhookRequest(request, params)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.info("[TwilioStatus] SMS delivery update", {
    messageSid: params.MessageSid || params.SmsSid || null,
    messageStatus: params.MessageStatus || null,
    to: params.To || null,
    errorCode: params.ErrorCode || null,
    errorMessage: params.ErrorMessage || null,
  });

  await handleTwilioStatusCallback(params);

  return NextResponse.json({ ok: true });
}
