"use client";

import { PeopleStrategyRouteError } from "@/components/people-strategy/route-error";

export default function OfficerMeetingsError({
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
      surface="Officer Meetings"
      backHref="/all-actions"
    />
  );
}
