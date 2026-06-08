"use client";

import { useRef, useTransition } from "react";

import { updatePartnerStage } from "@/lib/partners-actions";
import {
  PARTNER_STAGES,
  PARTNER_STAGE_LABELS,
  asPartnerStage,
} from "@/lib/partners-constants";

/**
 * Inline stage mover. Changing the select advances the partner through the
 * pipeline (and records a STAGE_CHANGE touchpoint) via the server action — no
 * extra click. Kept tiny and self-contained so the board stays server-rendered.
 */
export function StageSelect({
  partnerId,
  stage,
}: {
  partnerId: string;
  stage: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const current = asPartnerStage(stage);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updatePartnerStage} style={{ margin: 0 }}>
      <input type="hidden" name="id" value={partnerId} />
      <select
        name="stage"
        className="input"
        defaultValue={current}
        disabled={pending}
        aria-label="Pipeline stage"
        style={{ fontSize: 12, padding: "4px 8px", maxWidth: 200 }}
        onChange={() => {
          startTransition(() => formRef.current?.requestSubmit());
        }}
      >
        {PARTNER_STAGES.map((s) => (
          <option key={s} value={s}>
            {PARTNER_STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
