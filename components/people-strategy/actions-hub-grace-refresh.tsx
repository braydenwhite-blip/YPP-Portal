"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { msUntilHubRollOff } from "@/lib/people-strategy/action-approval";

/**
 * When the hub shows recently-approved actions, refresh after the grace window
 * so they roll off the main list without a manual reload.
 */
export function ActionsHubGraceRefresh({
  approvedAtValues,
}: {
  approvedAtValues: string[];
}) {
  const router = useRouter();

  useEffect(() => {
    if (approvedAtValues.length === 0) return;

    const now = new Date();
    const delays = approvedAtValues
      .map((value) => msUntilHubRollOff(new Date(value), now))
      .filter((ms) => ms > 0);

    if (delays.length === 0) return;

    const timeout = window.setTimeout(() => router.refresh(), Math.min(...delays) + 500);
    return () => window.clearTimeout(timeout);
  }, [approvedAtValues, router]);

  return null;
}
