"use client";

import { PeopleStrategyRouteError } from "@/components/people-strategy/route-error";

export default function PeopleDashboardError({
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
      surface="the People Dashboard"
      backHref="/actions/all"
    />
  );
}
