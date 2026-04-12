-- AlterTable
ALTER TABLE "NotificationPreference"
ADD COLUMN "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "smsPhoneE164" TEXT,
ADD COLUMN "smsConsentAt" TIMESTAMP(3),
ADD COLUMN "smsOptOutAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NotificationPreference_smsPhoneE164_idx" ON "NotificationPreference"("smsPhoneE164");
