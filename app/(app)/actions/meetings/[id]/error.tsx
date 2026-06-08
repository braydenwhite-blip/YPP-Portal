"use client";

import { PeopleStrategyRouteError } from "@/components/people-strategy/route-error";

export default function MeetingDetailError({
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
      surface="Meeting"
      backHref="/actions/meetings"
    />
  );
}
