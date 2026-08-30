import Link from "next/link";
import { notFound } from "next/navigation";

import { requireGuardianPortalUser } from "@/lib/family-access";
import { getConversationMessages, sendParentMessage } from "@/lib/parent-message-actions";

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ParentConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const user = await requireGuardianPortalUser();
  const { conversationId } = await params;

  const conversation = await getConversationMessages(conversationId);
  if (!conversation) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/parent/messages" className="text-sm font-semibold text-violet-700 hover:underline">
          ← Back to messages
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">{conversation.subject ?? "Conversation"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          With {conversation.participants
            .filter((p) => p.user.id !== user.id)
            .map((p) => p.user.name)
            .join(", ") || "instructor"}
        </p>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-4">
        {conversation.messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">
            No messages yet. Say hello below.
          </p>
        ) : (
          <div className="space-y-4">
            {conversation.messages.map((message) => {
              const isMine = message.sender.id === user.id;
              return (
                <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      isMine ? "bg-violet-700 text-white" : "bg-stone-100 text-slate-900"
                    }`}
                  >
                    {!isMine ? (
                      <p className="mb-1 text-xs font-semibold opacity-70">{message.sender.name}</p>
                    ) : null}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    <p className={`mt-1 text-[11px] ${isMine ? "text-violet-100" : "text-slate-500"}`}>
                      {formatTimestamp(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form action={sendParentMessage} className="flex gap-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <textarea
          name="content"
          required
          rows={2}
          placeholder="Write a message..."
          className="flex-1 resize-none rounded-2xl border border-stone-300 p-3 text-sm outline-none focus:border-violet-500"
        />
        <button
          type="submit"
          className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white self-end"
        >
          Send
        </button>
      </form>
    </div>
  );
}