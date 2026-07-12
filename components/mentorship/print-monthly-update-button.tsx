"use client";

import { Button } from "@/components/ui-v2";

export function PrintMonthlyUpdateButton() {
  return (
    <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
