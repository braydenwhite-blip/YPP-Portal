import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizePhoneNumberToE164,
  validateTwilioWebhookRequest,
} from "@/lib/sms";

const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "REVOKE",
  "OPTOUT",
]);

function emptyTwimlResponse() {
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

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

  const from = params.From;
  const optOutType = params.OptOutType?.toUpperCase();
  const body = params.Body?.trim().toUpperCase();
  const isStopRequest = optOutType === "STOP" || (body ? STOP_KEYWORDS.has(body) : false);

  if (from && isStopRequest) {
    const normalizedFrom = (() => {
      try {
        return normalizePhoneNumberToE164(from);
      } catch {
        return from;
      }
    })();

    await prisma.notificationPreference.updateMany({
      where: { smsPhoneE164: normalizedFrom },
      data: {
        smsEnabled: false,
        smsOptOutAt: new Date(),
      },
    });
  }

  return emptyTwimlResponse();
}
