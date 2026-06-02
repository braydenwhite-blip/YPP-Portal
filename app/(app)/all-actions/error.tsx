"use client";

import { PeopleStrategyRouteError } from "@/components/people-strategy/route-error";

export default function AllActionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PeopleStrategyRouteError
      error={error}
      reset={reset}
      surface="the Action Tracker"
      backHref="/my-actions"
    />
  );
}
