-- PostgreSQL requires the enum additions to commit before the new values can be used.
-- The enum values themselves are added in the immediately previous migration.

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
WHERE "isGroup" IS false
  AND "contextType" IS NULL;
