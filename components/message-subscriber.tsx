'use client';

import { useEffect } from 'react';
import { createPusherClient } from '@/lib/pusher';
import { useRouter } from 'next/navigation';

interface MessageSubscriberProps {
  conversationId: string;
  userId: string;
}

export function MessageSubscriber({ conversationId, userId }: MessageSubscriberProps) {
  const router = useRouter();

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

      // Optional: Show toast notification
      if (data.senderId !== userId) {
        // Could integrate with a toast library here
        // showToast(`New message from ${data.senderName}`);
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

  return null; // This component doesn't render anything
}

interface TypingIndicatorProps {
  conversationId: string;
  userId: string;
}

export function TypingIndicator({ conversationId, userId }: TypingIndicatorProps) {
  useEffect(() => {
    const pusher = createPusherClient();
    if (!pusher) {
      return;
    }

    const channel = pusher.subscribe(`conversation-${conversationId}`);

    channel.bind('typing-start', (data: any) => {
      if (data.userId !== userId) {
        // Show "{user.name} is typing..." indicator
        // This would require state management to show/hide the indicator
      }
    });

    channel.bind('typing-stop', () => {
      // Hide typing indicator
    });

    return () => {
      pusher.unsubscribe(`conversation-${conversationId}`);
      pusher.disconnect();
    };
  }, [conversationId, userId]);

  return null;
}
