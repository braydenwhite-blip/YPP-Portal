"use client";

import { PeopleStrategyRouteError } from "@/components/people-strategy/route-error";

export default function MyActionsError({
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
      surface="My Actions"
      backHref="/"
    />
  );
}
