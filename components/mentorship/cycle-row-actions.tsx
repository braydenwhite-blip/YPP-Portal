"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import {
  closeReviewCycle,
  setParticipantOverride,
} from "@/lib/mentorship/cycle-actions";

/** Waive / un-waive one participant of a review cycle. */
export function WaiveToggle({
  participantId,
  waived,
}: {
  participantId: string;
  waived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setParticipantOverride({
            participantId,
            override: waived ? null : "waived",
          });
          router.refresh();
        })
      }
    >
      {pending ? "…" : waived ? "Un-waive" : "Waive"}
    </Button>
  );
}

/** Close a finished (or abandoned) review cycle. */
export function CloseCycleButton({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await closeReviewCycle({ cycleId });
          router.refresh();
        })
      }
    >
      {pending ? "Closing…" : "Close cycle"}
    </Button>
  );
}
