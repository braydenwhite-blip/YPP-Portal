"use client";

import { Button, ButtonLink } from "@/components/ui-v2";

export default function InstructorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-blocked-700">Instructor workspace unavailable</p>
      <h1 className="m-0 mt-2 text-[26px] font-semibold tracking-[-0.02em] text-ink">Your teaching data could not be loaded</h1>
      <p className="m-0 mt-3 text-[14px] leading-6 text-ink-muted">
        Nothing has been marked complete or cleared. Try the live data request again, or return home.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" size="md" onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary" size="md">Return home</ButtonLink>
      </div>
    </main>
  );
}

