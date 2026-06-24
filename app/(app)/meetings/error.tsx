"use client";

import { PeopleStrategyRouteError } from "@/components/people-strategy/route-error";

export default function MeetingsError({
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
      surface="Meetings"
      backHref="/"
    />
  );
}
