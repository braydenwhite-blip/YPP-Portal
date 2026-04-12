import {
  NotificationDeliveryChannel as DbNotificationDeliveryChannel,
  NotificationDeliveryStatus,
  NotificationScenarioKey,
  NotificationType,
  NotificationUrgency,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendNotificationEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/portal-auth-utils";
import {
  getNotificationScenarioDefinition,
  isMatrixScenarioKey,
  type NotificationMatrixChannels,
} from "@/lib/notification-matrix";
import {
  type NotificationPolicyKey,
  resolveNotificationPolicyChannels,
  shouldCreatePortalNotification,
  shouldSendPolicyEmail,
} from "@/lib/notification-policy";
import { isSmsConfigured, sendSmsNotification } from "@/lib/sms";

export type DeliveryInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  sendEmail?: boolean;
  policyKey?: NotificationPolicyKey;
  scenarioKey?: NotificationScenarioKey;
  urgency?: NotificationUrgency;
};

type PreferenceRecord = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  smsPhoneE164: string | null;
  deliveryTimezone: string;
  announcements: boolean;
  mentorUpdates: boolean;
  goalReminders: boolean;
  courseUpdates: boolean;
  reflectionReminders: boolean;
  eventUpdates: boolean;
  eventReminders: boolean;
};

type DeliveryPlan = {
  channel: DbNotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  target: string | null;
  scheduledFor: Date | null;
  errorMessage: string | null;
};

type EmitNotificationResult = {
  notification: Record<string, unknown> | null;
  deliveryIds: string[];
};

type ResolvedRouting =
  | {
      mode: "matrix";
      scenarioKey: NotificationScenarioKey;
      urgency: NotificationUrgency;
      channels: NotificationMatrixChannels;
      createPortal: boolean;
      allowEmailOverride: boolean;
      smsFallback: boolean;
    }
  | {
      mode: "legacy";
      scenarioKey: "LEGACY_GENERIC";
      urgency: NotificationUrgency;
      channels: NotificationMatrixChannels;
      createPortal: boolean;
      allowEmailOverride: boolean;
      smsFallback: boolean;
      typeEnabled: boolean;
    };

const ACTION_REQUIRED_PREFIX = "[Action Required] ";
const DEFAULT_DELIVERY_TIMEZONE = "America/New_York";

function preferenceKeyForType(type: NotificationType): keyof PreferenceRecord | null {
  switch (type) {
    case "ANNOUNCEMENT":
      return "announcements";
    case "MENTOR_FEEDBACK":
      return "mentorUpdates";
    case "GOAL_DEADLINE":
      return "goalReminders";
    case "COURSE_UPDATE":
    case "CLASS_REMINDER":
      return "courseUpdates";
    case "REFLECTION_REMINDER":
      return "reflectionReminders";
    case "EVENT_UPDATE":
      return "eventUpdates";
    case "EVENT_REMINDER":
      return "eventReminders";
    default:
      return null;
  }
}

function isTypeEnabled(
  preferences: PreferenceRecord | null | undefined,
  type: NotificationType
) {
  const key = preferenceKeyForType(type);
  if (!key) return true;
  return preferences?.[key] ?? true;
}

function toAbsolutePortalUrl(link?: string | null) {
  if (!link) return undefined;
  if (/^https?:\/\//i.test(link)) return link;
  const normalizedLink = link.startsWith("/") ? link : `/${link}`;
  return `${getBaseUrl()}${normalizedLink}`;
}

function getSafeTimeZone(timeZone?: string | null) {
  const candidate = timeZone?.trim() || DEFAULT_DELIVERY_TIMEZONE;

  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_DELIVERY_TIMEZONE;
  }
}

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function shiftLocalDate(
  dateParts: { year: number; month: number; day: number },
  days: number
) {
  const base = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
  base.setUTCDate(base.getUTCDate() + days);

  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function zonedDateTimeToUtc(
  localDateTime: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
  },
  timeZone: string
) {
  let guess = Date.UTC(
    localDateTime.year,
    localDateTime.month - 1,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute,
    localDateTime.second ?? 0
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = getZonedDateParts(new Date(guess), timeZone);
    const target = Date.UTC(
      localDateTime.year,
      localDateTime.month - 1,
      localDateTime.day,
      localDateTime.hour,
      localDateTime.minute,
      localDateTime.second ?? 0
    );
    const observed = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second
    );

    const diff = target - observed;
    if (diff === 0) {
      break;
    }

    guess += diff;
  }

  return new Date(guess);
}

function calculateQuietHoursSchedule(
  urgency: NotificationUrgency,
  timeZone: string,
  now = new Date()
) {
  if (urgency === "P0" || urgency === "P1") {
    return null;
  }

  const zoned = getZonedDateParts(now, timeZone);
  const duringQuietHours = zoned.hour >= 22 || zoned.hour < 7;

  if (!duringQuietHours) {
    return null;
  }

  const targetDate =
    zoned.hour >= 22
      ? shiftLocalDate({ year: zoned.year, month: zoned.month, day: zoned.day }, 1)
      : { year: zoned.year, month: zoned.month, day: zoned.day };

  return zonedDateTimeToUtc(
    {
      ...targetDate,
      hour: 7,
      minute: 0,
      second: 0,
    },
    timeZone
  );
}

function resolveRouting(
  input: DeliveryInput,
  preferences: PreferenceRecord | null | undefined
): ResolvedRouting {
  if (isMatrixScenarioKey(input.scenarioKey)) {
    const definition = getNotificationScenarioDefinition(input.scenarioKey!, input.urgency);

    return {
      mode: "matrix",
      scenarioKey: definition.key,
      urgency: definition.urgency,
      channels: definition.channels,
      createPortal: definition.channels.portal,
      allowEmailOverride: input.sendEmail !== false,
      smsFallback: definition.smsFallback === "EMAIL_ACTION_REQUIRED",
    };
  }

  const typeEnabled = isTypeEnabled(preferences, input.type);
  const legacyChannels = input.policyKey
    ? resolveNotificationPolicyChannels(input.policyKey)
    : {
        inApp: shouldCreatePortalNotification(input.type),
        email: shouldSendPolicyEmail(input.type, input.sendEmail !== false),
        sms: false,
      };

  return {
    mode: "legacy",
    scenarioKey: "LEGACY_GENERIC",
    urgency: "P2",
    channels: {
      portal: legacyChannels.inApp,
      email: legacyChannels.email,
      sms: legacyChannels.sms,
    },
    createPortal: legacyChannels.inApp && (preferences?.inAppEnabled ?? true) && typeEnabled,
    allowEmailOverride: input.sendEmail !== false,
    smsFallback: false,
    typeEnabled,
  };
}

function buildEmailPlan(
  input: DeliveryInput,
  routing: ResolvedRouting,
  user: {
    email: string | null;
    notificationPreference: PreferenceRecord | null;
  }
): DeliveryPlan | null {
  if (!routing.channels.email) {
    return null;
  }

  const timeZone = getSafeTimeZone(user.notificationPreference?.deliveryTimezone);
  const scheduledFor =
    routing.mode === "matrix"
      ? calculateQuietHoursSchedule(routing.urgency, timeZone)
      : calculateQuietHoursSchedule(routing.urgency, timeZone);

  if (!routing.allowEmailOverride) {
    return {
      channel: "EMAIL",
      status: "SKIPPED",
      target: user.email,
      scheduledFor: null,
      errorMessage: "Email delivery was disabled for this notification.",
    };
  }

  if (routing.mode === "legacy" && !routing.typeEnabled) {
    return {
      channel: "EMAIL",
      status: "SKIPPED",
      target: user.email,
      scheduledFor: null,
      errorMessage: "This notification category is turned off.",
    };
  }

  if (routing.mode === "legacy" && !(user.notificationPreference?.emailEnabled ?? true)) {
    return {
      channel: "EMAIL",
      status: "SKIPPED",
      target: user.email,
      scheduledFor: null,
      errorMessage: "Email notifications are turned off.",
    };
  }

  if (!user.email) {
    return {
      channel: "EMAIL",
      status: "FAILED",
      target: null,
      scheduledFor: null,
      errorMessage: "Recipient does not have an email address on file.",
    };
  }

  if (!isEmailConfigured()) {
    return {
      channel: "EMAIL",
      status: "FAILED",
      target: user.email,
      scheduledFor: null,
      errorMessage: "Email service is not configured.",
    };
  }

  return {
    channel: "EMAIL",
    status: "QUEUED",
    target: user.email,
    scheduledFor,
    errorMessage: null,
  };
}

function buildSmsPlan(
  routing: ResolvedRouting,
  user: {
    notificationPreference: PreferenceRecord | null;
  }
): DeliveryPlan | null {
  if (!routing.channels.sms) {
    return null;
  }

  const target = user.notificationPreference?.smsPhoneE164 ?? null;
  const timeZone = getSafeTimeZone(user.notificationPreference?.deliveryTimezone);
  const scheduledFor = calculateQuietHoursSchedule(routing.urgency, timeZone);

  if (routing.mode === "legacy" && !routing.typeEnabled) {
    return {
      channel: "SMS",
      status: "SKIPPED",
      target,
      scheduledFor: null,
      errorMessage: "This notification category is turned off.",
    };
  }

  if (!user.notificationPreference?.smsEnabled) {
    return {
      channel: "SMS",
      status: routing.mode === "matrix" ? "FAILED" : "SKIPPED",
      target,
      scheduledFor: null,
      errorMessage: "Recipient has not opted into SMS notifications.",
    };
  }

  if (!target) {
    return {
      channel: "SMS",
      status: routing.mode === "matrix" ? "FAILED" : "SKIPPED",
      target: null,
      scheduledFor: null,
      errorMessage: "Recipient does not have an SMS number on file.",
    };
  }

  if (!isSmsConfigured()) {
    return {
      channel: "SMS",
      status: routing.mode === "matrix" ? "FAILED" : "SKIPPED",
      target,
      scheduledFor: null,
      errorMessage: "SMS service is not configured.",
    };
  }

  return {
    channel: "SMS",
    status: "QUEUED",
    target,
    scheduledFor,
    errorMessage: null,
  };
}

async function createDeliveryRecord(input: {
  notificationId: string | null;
  delivery: DeliveryPlan;
  source: DeliveryInput;
  routing: ResolvedRouting;
  isFallback?: boolean;
  fallbackForDeliveryId?: string | null;
}) {
  return prisma.notificationDelivery.create({
    data: {
      notificationId: input.notificationId,
      userId: input.source.userId,
      scenarioKey: input.routing.scenarioKey,
      urgency: input.routing.urgency,
      channel: input.delivery.channel,
      title: input.source.title,
      body: input.source.body,
      link: input.source.link ?? null,
      status: input.delivery.status,
      target: input.delivery.target,
      scheduledFor: input.delivery.scheduledFor,
      errorMessage: input.delivery.errorMessage,
      isFallback: input.isFallback ?? false,
      fallbackForDeliveryId: input.fallbackForDeliveryId ?? null,
    },
    select: { id: true },
  });
}

async function processEmailDelivery(
  deliveryId: string,
  subjectPrefix?: string
) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  if (!delivery || delivery.channel !== "EMAIL") {
    return;
  }

  if (!delivery.target || !delivery.user.email) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: "Recipient email address is unavailable.",
      },
    });
    return;
  }

  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "PROCESSING",
      attemptedAt: new Date(),
    },
  });

  try {
    const result = await sendNotificationEmail({
      to: delivery.user.email,
      name: delivery.user.name ?? "there",
      title: delivery.title,
      body: delivery.body,
      link: toAbsolutePortalUrl(delivery.link),
      subjectPrefix,
    });

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: result.success
        ? {
            status: "DELIVERED",
            provider: "email",
            providerStatus: "delivered",
            sentAt: new Date(),
            deliveredAt: new Date(),
            errorCode: null,
            errorMessage: null,
          }
        : {
            status: "FAILED",
            provider: "email",
            providerStatus: "failed",
            failedAt: new Date(),
            errorMessage: result.error ?? "Email delivery failed.",
          },
    });
  } catch (error) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        provider: "email",
        providerStatus: "failed",
        failedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Email delivery failed.",
      },
    });
  }
}

async function createSmsFallbackEmail(deliveryId: string) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      fallbackDeliveries: {
        select: { id: true },
      },
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  if (!delivery || delivery.channel !== "SMS" || delivery.fallbackDeliveries.length > 0) {
    return;
  }

  if (
    !isMatrixScenarioKey(delivery.scenarioKey) ||
    getNotificationScenarioDefinition(delivery.scenarioKey, delivery.urgency).smsFallback !==
      "EMAIL_ACTION_REQUIRED"
  ) {
    return;
  }

  if (!delivery.user.email) {
    return;
  }

  const fallback = await prisma.notificationDelivery.create({
    data: {
      notificationId: delivery.notificationId,
      userId: delivery.userId,
      scenarioKey: delivery.scenarioKey,
      urgency: delivery.urgency,
      channel: "EMAIL",
      title: delivery.title,
      body: delivery.body,
      link: delivery.link,
      status: "QUEUED",
      target: delivery.user.email,
      isFallback: true,
      fallbackForDeliveryId: delivery.id,
      provider: "email",
    },
    select: { id: true },
  });

  await processEmailDelivery(fallback.id, ACTION_REQUIRED_PREFIX);
}

async function processSmsDelivery(deliveryId: string) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery || delivery.channel !== "SMS") {
    return;
  }

  if (!delivery.target) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: "Recipient phone number is unavailable.",
      },
    });
    await createSmsFallbackEmail(delivery.id);
    return;
  }

  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "PROCESSING",
      attemptedAt: new Date(),
    },
  });

  const result = await sendSmsNotification({
    to: delivery.target,
    title: delivery.title,
    body: delivery.body,
    link: delivery.link,
  });

  if (result.success && result.sid) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        provider: "twilio",
        providerMessageId: result.sid,
        providerStatus: "queued",
        sentAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    return;
  }

  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "FAILED",
      provider: "twilio",
      providerStatus: "failed",
      failedAt: new Date(),
      errorMessage: result.error ?? "SMS delivery failed.",
    },
  });

  await createSmsFallbackEmail(delivery.id);
}

async function processNotificationDeliveryById(deliveryId: string) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      channel: true,
      status: true,
      scheduledFor: true,
      isFallback: true,
    },
  });

  if (!delivery || delivery.status !== "QUEUED") {
    return;
  }

  if (delivery.scheduledFor && delivery.scheduledFor > new Date()) {
    return;
  }

  if (delivery.channel === "EMAIL") {
    await processEmailDelivery(
      delivery.id,
      delivery.isFallback ? ACTION_REQUIRED_PREFIX : undefined
    );
    return;
  }

  if (delivery.channel === "SMS") {
    await processSmsDelivery(delivery.id);
  }
}

export async function processPendingNotificationDeliveries(limit = 100) {
  const pending = await prisma.notificationDelivery.findMany({
    where: {
      status: "QUEUED",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  for (const delivery of pending) {
    await processNotificationDeliveryById(delivery.id);
  }

  return {
    processed: pending.length,
  };
}

export async function retryNotificationDelivery(deliveryId: string) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!delivery) {
    throw new Error("Delivery not found.");
  }

  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "QUEUED",
      attemptedAt: null,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      providerStatus: null,
      scheduledFor: null,
    },
  });

  await processNotificationDeliveryById(delivery.id);
}

export async function handleTwilioStatusCallback(params: Record<string, string>) {
  const providerMessageId = params.MessageSid || params.SmsSid;
  if (!providerMessageId) {
    return { updated: false };
  }

  const delivery = await prisma.notificationDelivery.findUnique({
    where: { providerMessageId },
    select: {
      id: true,
      channel: true,
      isFallback: true,
    },
  });

  if (!delivery || delivery.channel !== "SMS") {
    return { updated: false };
  }

  const providerStatus = (params.MessageStatus || "").toLowerCase();
  const now = new Date();

  if (providerStatus === "delivered") {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "DELIVERED",
        providerStatus,
        deliveredAt: now,
        errorCode: null,
        errorMessage: null,
      },
    });
    return { updated: true };
  }

  if (providerStatus === "failed" || providerStatus === "undelivered") {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        providerStatus,
        failedAt: now,
        errorCode: params.ErrorCode || null,
        errorMessage: params.ErrorMessage || "SMS delivery failed.",
      },
    });

    await createSmsFallbackEmail(delivery.id);
    return { updated: true };
  }

  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "SENT",
      providerStatus: providerStatus || null,
      errorCode: params.ErrorCode || null,
      errorMessage: params.ErrorMessage || null,
    },
  });

  return { updated: true };
}

export async function emitNotification(input: DeliveryInput): Promise<EmitNotificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      name: true,
      notificationPreference: {
        select: {
          emailEnabled: true,
          inAppEnabled: true,
          smsEnabled: true,
          smsPhoneE164: true,
          deliveryTimezone: true,
          announcements: true,
          mentorUpdates: true,
          goalReminders: true,
          courseUpdates: true,
          reflectionReminders: true,
          eventUpdates: true,
          eventReminders: true,
        },
      },
    },
  });

  if (!user) {
    return { notification: null, deliveryIds: [] };
  }

  const routing = resolveRouting(input, user.notificationPreference);

  const notification = routing.createPortal
    ? await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          scenarioKey: routing.scenarioKey,
          urgency: routing.urgency,
          title: input.title,
          body: input.body,
          link: input.link || null,
        },
      })
    : null;

  const deliveryPlans = [buildEmailPlan(input, routing, user), buildSmsPlan(routing, user)].filter(
    Boolean
  ) as DeliveryPlan[];

  const deliveryIds: string[] = [];

  for (const plan of deliveryPlans) {
    const created = await createDeliveryRecord({
      notificationId: notification?.id ?? null,
      delivery: plan,
      source: input,
      routing,
    });
    deliveryIds.push(created.id);

    if (plan.channel === "SMS" && plan.status === "FAILED" && routing.smsFallback) {
      await createSmsFallbackEmail(created.id);
    }
  }

  for (const deliveryId of deliveryIds) {
    await processNotificationDeliveryById(deliveryId);
  }

  return {
    notification,
    deliveryIds,
  };
}

export async function deliverNotification(input: DeliveryInput) {
  const result = await emitNotification(input);
  return result.notification;
}

export async function deliverBulkNotifications(inputs: DeliveryInput[]) {
  const uniqueInputs = new Map<string, DeliveryInput>();

  for (const input of inputs) {
    uniqueInputs.set(
      [
        input.userId,
        input.type,
        input.title,
        input.link ?? "",
        input.policyKey ?? "",
        input.scenarioKey ?? "",
        input.urgency ?? "",
      ].join(":"),
      input
    );
  }

  for (const input of uniqueInputs.values()) {
    await emitNotification(input);
  }
}
