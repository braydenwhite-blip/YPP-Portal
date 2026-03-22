"use client";

import { useTransition } from "react";
import { rsvpToEvent } from "@/lib/alumni-network-actions";

interface Props {
  eventId: string;
  currentStatus: string | null;
  isFull?: boolean;
}

export default function RsvpClient({ eventId, currentStatus, isFull }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRsvp(status: string) {
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("status", status);
    startTransition(async () => {
      try {
        await rsvpToEvent(fd);
      } catch (e) {
        alert(e instanceof Error ? e.message : "RSVP failed");
      }
    });
  }

  if (currentStatus === "GOING") {
    return (
      <button
        className="button secondary small"
        onClick={() => handleRsvp("NOT_GOING")}
        disabled={isPending}
        style={{ fontSize: "0.75rem" }}
      >
        Cancel RSVP
      </button>
    );
  }

  return (
    <button
      className="button primary small"
      onClick={() => handleRsvp("GOING")}
      disabled={isPending || (isFull && currentStatus !== "GOING")}
      style={{ fontSize: "0.75rem" }}
    >
      {isPending ? "…" : isFull ? "Full" : "RSVP"}
    </button>
  );
}
