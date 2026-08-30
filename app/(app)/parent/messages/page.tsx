import Link from "next/link";

import { EmptyState } from "@/components/family-portal/portal-shells";
import { requireGuardianPortalUser } from "@/lib/family-access";
import { getParentConversations } from "@/lib/parent-message-actions";

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

export default async function ParentMessagesPage() {
  await requireGuardianPortalUser();
  const conversations = await getParentConversations();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-violet-700">Family portal</p>
        <h1 className="text-3xl font-semibold">Messages</h1>
        <p className="mt-2 text-slate-600">
          Conversations with your student&apos;s instructors, in one place.
        </p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          body="Open a student on My Students and choose Message Instructor to start a conversation."
          action={
            <Link
              href="/parent/students"
              className="inline-flex rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
            >
              View my students
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <Link
              key={conversation.conversationId}
              href={`/parent/messages/${conversation.conversationId}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 hover:border-violet-300"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{conversation.subject}</p>
                  {conversation.hasUnread ? (
                    <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-violet-700" aria-label="Unread" />
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">
                  {conversation.lastMessage
                    ? `${conversation.lastMessage.sender?.name ?? "Someone"}: ${truncate(conversation.lastMessage.content, 90)}`
                    : "No messages yet"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">
                {formatTimestamp(conversation.updatedAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}