-- Migration: action_tracker_expand_departments
-- Add the org-wide standing teams officers use to tag Action Tracker work
-- (chapters, tech, comms, social, fundraising, officers, board) alongside the
-- existing five core teams. Idempotent — safe to re-run.

INSERT INTO "Department" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Chapters', 'chapters', 'Chapter launches, expansion, and local chapter leads.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Tech', 'tech', 'Portal, tooling, automation, and technical delivery.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Communications', 'communications', 'Org-wide messaging, announcements, and comms strategy.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Social Media', 'social-media', 'Social content, campaigns, and channel management.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Fundraising', 'fundraising', 'Donor outreach, sponsorships, and fundraising campaigns.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Officers', 'officers', 'Officer-team work that spans multiple functions.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Board', 'board', 'Board-facing priorities, governance, and approvals.', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
