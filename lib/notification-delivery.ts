import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendNotificationEmail } from "@/lib/email";
import {
  getNotificationPolicy,
  shouldCreatePortalNotification,
  shouldSendPolicyEmail,
} from "@/lib/notification-policy";

type DeliveryInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  sendEmail?: boolean;
};

function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function deliverNotification(input: DeliveryInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) return null;

  const policy = getNotificationPolicy(input.type);
  const shouldCreateInApp = shouldCreatePortalNotification(input.type);
  const shouldSendEmail =
    shouldSendPolicyEmail(input.type, input.sendEmail !== false) &&
    isEmailConfigured();

  let notification = null;

  if (shouldCreateInApp) {
    notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link || null,
      },
    });
  }

  if (shouldSendEmail) {
    const fullLink = input.link
      ? `${getBaseUrl()}${input.link.startsWith("/") ? input.link : `/${input.link}`}`
      : undefined;

    await sendNotificationEmail({
      to: user.email,
      name: user.name,
      title: input.title,
      body: input.body,
      link: fullLink,
    }).catch((error) => {
      console.error("[NotificationDelivery] Failed to send email:", error);
    });
  }

  if (policy.smsPlanned) {
    console.info(
      `[NotificationDelivery] SMS is planned but not implemented yet for ${input.type}.`
    );
  }

  return notification;
}

export async function deliverBulkNotifications(inputs: DeliveryInput[]) {
  const uniqueInputs = new Map<string, DeliveryInput>();

  for (const input of inputs) {
    uniqueInputs.set(`${input.userId}:${input.type}:${input.title}:${input.link ?? ""}`, input);
  }

  for (const input of uniqueInputs.values()) {
    await deliverNotification(input);
  }
}
