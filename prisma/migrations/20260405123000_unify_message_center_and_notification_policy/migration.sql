-- AlterEnum
ALTER TYPE "ConversationContextType" ADD VALUE IF NOT EXISTS 'DIRECT';
ALTER TYPE "ConversationContextType" ADD VALUE IF NOT EXISTS 'PARENT';

-- Delete legacy Community Chat group conversations before the shared inbox goes live
DELETE FROM "Message"
WHERE "conversationId" IN (
    SELECT "id" FROM "Conversation" WHERE "isGroup" = true
);

DELETE FROM "ConversationParticipant"
WHERE "conversationId" IN (
    SELECT "id" FROM "Conversation" WHERE "isGroup" = true
);

DELETE FROM "Conversation"
WHERE "isGroup" = true;

-- Backfill existing non-group conversations into explicit contexts
UPDATE "Conversation"
SET "contextType" = 'PARENT'
WHERE "isGroup" = false
  AND "contextType" IS NULL
  AND "subject" LIKE '% — Parent Updates';

UPDATE "Conversation"
SET "contextType" = 'DIRECT'
WHERE "isGroup" = false
  AND "contextType" IS NULL;
