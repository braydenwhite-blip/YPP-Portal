"use client";

import { Button } from "@/components/ui-v2";

/** Print / save-as-PDF the Impact Meeting brief for offline use in the meeting. */
export function PrintBriefButton() {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
      Print brief
    </Button>
  );
}
