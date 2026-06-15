import type { QueueItem } from "@/lib/queue/types";

import { QueueStrip } from "./queue-strip";

/**
 * MeetingPrepQueue / PostMeetingQueue — the meeting operating rhythm, expressed
 * as queues. Prep answers "what do I review before this meeting?"; post-meeting
 * answers "what follow-ups are still open and what needs to become an action?".
 */

export function MeetingPrepQueue({ items }: { items: QueueItem[] }) {
  return (
    <QueueStrip
      title="Meeting prep"
      tagline="Review these loops before your next meetings."
      items={items}
      queueKey="meeting-prep"
      accent="info"
      emptyText="No upcoming meetings need prep right now."
    />
  );
}

export function PostMeetingQueue({ items }: { items: QueueItem[] }) {
  return (
    <QueueStrip
      title="Post-meeting follow-ups"
      tagline="Open follow-ups and decisions that still need to become actions."
      items={items}
      queueKey="post-meeting"
      accent="warning"
      emptyText="Every past meeting is closed out — no open follow-ups."
    />
  );
}
