-- CreateEnum
CREATE TYPE "NotificationUrgency" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "NotificationScenarioKey" AS ENUM (
  'LEGACY_GENERIC',
  'SYSTEM_SMS_TEST',
  'APPLICANT_STATUS_CHANGE_NEXT_STAGE',
  'APPLICANT_INTERVIEW_SCHEDULED',
  'APPLICANT_INTERVIEW_REMINDER_24H',
  'APPLICANT_DECISION_RELEASED',
  'STUDENT_ATTENDANCE_ALERT_UNEXCUSED_ABSENCE',
  'STUDENT_CLASS_REMINDER_1H',
  'STUDENT_FEEDBACK_GRADE_POSTED',
  'STUDENT_WAITLIST_OFFER_AVAILABLE',
  'STUDENT_WAITLIST_OFFER_EXPIRING_6H',
  'STUDENT_NEW_BADGE_EARNED',
  'STUDENT_PEER_KUDOS_RECEIVED',
  'MENTOR_NEW_REFLECTION_SUBMITTED',
  'MENTOR_GOAL_REVIEW_DUE_48H',
  'MENTOR_GOAL_REVIEW_OVERDUE',
  'MENTOR_CHANGES_REQUESTED_BY_CHAIR',
  'MENTOR_NEW_MENTEE_ASSIGNED',
  'MENTOR_MILESTONE_REACHED',
  'MENTOR_SCHEDULED_CHECK',
  'MENTOR_CHECK_SOON_24H',
  'INSTRUCTOR_CLASS_SESSION_REMINDER_1H',
  'INSTRUCTOR_ATTENDANCE_NOT_LOGGED_POST_SESSION',
  'INSTRUCTOR_NEW_STUDENT_ENROLLMENT',
  'INSTRUCTOR_TRAINING_MODULE_ASSIGNED',
  'INSTRUCTOR_TRAINING_DUE_SOON',
  'CHAPTER_PRESIDENT_HIRING_DECISION_PENDING_CHAIR',
  'CHAPTER_PRESIDENT_GOAL_REVIEW_PENDING_APPROVAL',
  'CHAPTER_PRESIDENT_NEW_CHAPTER_JOIN_REQUEST',
  'CHAPTER_PRESIDENT_CHAPTER_ACHIEVEMENT_EARNED',
  'CHAPTER_PRESIDENT_OPERATIONAL_RISK_ALERT',
  'CHAPTER_LEAD_NEW_APPLICANT_IN_QUEUE',
  'CHAPTER_LEAD_INTERVIEW_REQUEST_ACCEPTED',
  'CHAPTER_LEAD_NEW_MEMBER_ONBOARDING_STATUS',
  'CHAPTER_LEAD_CHAPTER_ANNOUNCEMENT_POSTED',
  'ADMIN_SYSTEM_ERROR_API_FAILURE',
  'ADMIN_ESCALATED_SUPPORT_REQUEST',
  'ADMIN_NEW_CHAPTER_PROPOSAL',
  'ADMIN_GLOBAL_ACHIEVEMENT_SUMMARY',
  'PARENT_ATTENDANCE_ALERT_ABSENCE',
  'PARENT_PROGRESS_REPORT_AVAILABLE',
  'PARENT_NEW_DIRECT_MESSAGE_FROM_INSTRUCTOR',
  'SYSTEM_PASSWORD_RESET_LOGIN_ALERT',
  'SYSTEM_ROLE_CHANGE_CONFIRMATION',
  'SYSTEM_NEW_MESSAGING_THREAD',
  'SYSTEM_NEW_MESSAGE'
);

-- CreateEnum
CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'QUEUED',
  'PROCESSING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'SKIPPED',
  'CANCELED'
);

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "scenarioKey" "NotificationScenarioKey" NOT NULL DEFAULT 'LEGACY_GENERIC',
ADD COLUMN "urgency" "NotificationUrgency" NOT NULL DEFAULT 'P2';

-- AlterTable
ALTER TABLE "NotificationPreference"
ADD COLUMN "deliveryTimezone" TEXT NOT NULL DEFAULT 'America/New_York';

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "priority" "MessagePriority" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT,
  "userId" TEXT NOT NULL,
  "scenarioKey" "NotificationScenarioKey" NOT NULL,
  "urgency" "NotificationUrgency" NOT NULL,
  "channel" "NotificationDeliveryChannel" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "target" TEXT,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "providerStatus" TEXT,
  "scheduledFor" TIMESTAMP(3),
  "attemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "fallbackForDeliveryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_scenarioKey_urgency_idx" ON "Notification"("scenarioKey", "urgency");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_createdAt_idx" ON "NotificationDelivery"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_scheduledFor_channel_idx" ON "NotificationDelivery"("status", "scheduledFor", "channel");

-- CreateIndex
CREATE INDEX "NotificationDelivery_scenarioKey_urgency_channel_idx" ON "NotificationDelivery"("scenarioKey", "urgency", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_providerMessageId_key" ON "NotificationDelivery"("providerMessageId");

-- AddForeignKey
ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_fallbackForDeliveryId_fkey"
FOREIGN KEY ("fallbackForDeliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
