"use client";

import { PeopleStrategyRouteError } from "@/components/people-strategy/route-error";

export default function AdminActionsError({
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
      surface="the admin action tools"
      backHref="/all-actions"
    />
  );
}
