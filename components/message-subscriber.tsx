'use client';

import { useEffect, useState } from 'react';
import { createPusherClient } from '@/lib/pusher';
import { useRouter } from 'next/navigation';

interface MessageSubscriberProps {
  conversationId: string;
  userId: string;
}

export function MessageSubscriber({ conversationId, userId }: MessageSubscriberProps) {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; sender: string } | null>(null);

  useEffect(() => {
    const pusher = createPusherClient();
    if (!pusher) {
      // Pusher not configured, fall back to polling (revalidatePath)
      return;
    }

    const conversationChannel = pusher.subscribe(`conversation-${conversationId}`);
    const userChannel = pusher.subscribe(`user-${userId}`);

    conversationChannel.bind('new-message', (data: any) => {
      // Refresh to show new message
      router.refresh();

      // Show toast notification for messages from others
      if (data.senderId !== userId) {
        setToast({
          message: data.content.substring(0, 60) + (data.content.length > 60 ? '...' : ''),
          sender: data.senderName
        });

        // Auto-dismiss toast after 4 seconds
        setTimeout(() => setToast(null), 4000);
      }
    });

    userChannel.bind('notification', (data: any) => {
      // Global notification badge update
      router.refresh();
    });

    return () => {
      pusher.unsubscribe(`conversation-${conversationId}`);
      pusher.unsubscribe(`user-${userId}`);
      pusher.disconnect();
    };
  }, [conversationId, userId, router]);

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 animate-slideIn"
          style={{
            maxWidth: '320px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {toast.sender.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 2 }}>
                {toast.sender}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: '1.4' }}>
                {toast.message}
              </div>
            </div>
            <button
              onClick={() => setToast(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: 0,
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Global CSS for toast animation */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

interface TypingIndicatorProps {
  conversationId: string;
  userId: string;
}

export function TypingIndicator({ conversationId, userId }: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [typingNames, setTypingNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const pusher = createPusherClient();
    if (!pusher) {
      return;
    }

    const channel = pusher.subscribe(`conversation-${conversationId}`);

    channel.bind('typing-start', (data: { userId: string; userName: string }) => {
      if (data.userId !== userId) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));
        setTypingNames((prev) => new Map(prev).set(data.userId, data.userName));

        // Auto-clear after 3 seconds (in case typing-stop never fires)
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
          });
        }, 3000);
      }
    });

    channel.bind('typing-stop', (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    });

    return () => {
      pusher.unsubscribe(`conversation-${conversationId}`);
      pusher.disconnect();
    };
  }, [conversationId, userId]);

  if (typingUsers.size === 0) {
    return null;
  }

  const names = Array.from(typingUsers)
    .map((id) => typingNames.get(id))
    .filter(Boolean);

  const displayText =
    names.length === 1
      ? `${names[0]} is typing...`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing...`
      : `${names[0]} and ${names.length - 1} others are typing...`;

  return (
    <div
      style={{
        padding: '8px 12px',
        fontSize: 13,
        color: '#6b7280',
        fontStyle: 'italic',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Animated typing dots */}
      <span className="typing-dots">
        <span>•</span>
        <span>•</span>
        <span>•</span>
      </span>
      {displayText}

      <style jsx>{`
        .typing-dots span {
          animation: blink 1.4s infinite;
          opacity: 0;
        }
        .typing-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .typing-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes blink {
          0%,
          60%,
          100% {
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
