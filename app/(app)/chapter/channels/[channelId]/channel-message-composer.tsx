"use client";

import { useState, useRef } from "react";
import { sendChannelMessage } from "@/lib/chapter-channel-actions";
import { useRouter } from "next/navigation";

export function ChannelMessageComposer({ channelId }: { channelId: string }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await sendChannelMessage(channelId, message);
      setMessage("");
      router.refresh();
      inputRef.current?.focus();
    } catch {
      // error handled by server
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <textarea
        ref={inputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
        className="input"
        rows={1}
        maxLength={2000}
        style={{
          flex: 1,
          resize: "none",
          minHeight: 38,
          maxHeight: 120,
          fontSize: 14,
        }}
      />
      <button
        className="button small"
        onClick={handleSend}
        disabled={!message.trim() || sending}
        style={{ flexShrink: 0, height: 38 }}
      >
        {sending ? "..." : "Send"}
      </button>
    </div>
  );
}
