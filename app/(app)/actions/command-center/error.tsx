"use client";

import { PeopleStrategyRouteError } from "@/components/people-strategy/route-error";

export default function CommandCenterError({
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
      surface="the Command Center"
      backHref="/actions"
    />
  );
}
