-- Migration: add_mentor_weekly_digest_notification
-- Adds the MENTOR_WEEKLY_DIGEST notification type used by the weekly mentor
-- digest cron. Kept in its own migration so the enum value is committed
-- before any later migration references it.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTOR_WEEKLY_DIGEST';
