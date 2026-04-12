import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import twilio from "twilio";

let twilioClient: ReturnType<typeof twilio> | null = null;

export type SmsResult = {
  success: boolean;
  sid?: string;
  error?: string;
};

type SendSmsNotificationInput = {
  to: string;
  title: string;
  body: string;
  link?: string | null;
};

function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() || "",
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() || "",
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || "",
    fromNumber: process.env.TWILIO_FROM_NUMBER?.trim() || "",
  };
}

export function isSmsConfigured() {
  const { accountSid, authToken, messagingServiceSid, fromNumber } = getTwilioConfig();
  return Boolean(accountSid && authToken && (messagingServiceSid || fromNumber));
}

function getTwilioClient() {
  if (!isSmsConfigured()) {
    return null;
  }

  if (!twilioClient) {
    const { accountSid, authToken } = getTwilioConfig();
    twilioClient = twilio(accountSid, authToken);
  }

  return twilioClient;
}

function toAbsolutePortalUrl(link?: string | null) {
  if (!link) return undefined;
  if (/^https?:\/\//i.test(link)) return link;
  const normalizedLink = link.startsWith("/") ? link : `/${link}`;
  return `${getBaseUrl()}${normalizedLink}`;
}

function buildSmsBody(input: SendSmsNotificationInput) {
  const lines = [
    collapseWhitespace(input.title),
    collapseWhitespace(input.body),
    toAbsolutePortalUrl(input.link),
  ].filter(Boolean);

  return lines.join("\n");
}

export function normalizePhoneNumberToE164(
  rawPhone: string,
  defaultCountry: CountryCode = "US"
) {
  const parsed = parsePhoneNumberFromString(rawPhone, defaultCountry);
  if (!parsed?.isValid()) {
    throw new Error("Enter a valid phone number that can receive text messages.");
  }

  return parsed.number;
}

export async function sendSmsNotification(input: SendSmsNotificationInput): Promise<SmsResult> {
  const client = getTwilioClient();
  if (!client) {
    return {
      success: false,
      error: "SMS service not configured",
    };
  }

  const { messagingServiceSid, fromNumber } = getTwilioConfig();

  try {
    const message = await client.messages.create({
      to: input.to,
      body: buildSmsBody(input),
      ...(messagingServiceSid
        ? { messagingServiceSid }
        : { from: fromNumber }),
      statusCallback: `${getBaseUrl()}/api/twilio/status`,
    });

    return {
      success: true,
      sid: message.sid,
    };
  } catch (error) {
    console.error("[SMS] Failed to send SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}

export function getTwilioSignatureValidationUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto) {
    url.protocol = `${forwardedProto}:`;
  }

  if (forwardedHost) {
    url.host = forwardedHost;
  }

  return url.toString();
}

export function validateTwilioWebhookRequest(
  request: Request,
  params: Record<string, string>
) {
  const signature = request.headers.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!signature || !authToken) {
    return false;
  }

  return twilio.validateRequest(
    authToken,
    signature,
    getTwilioSignatureValidationUrl(request),
    params
  );
}
