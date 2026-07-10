"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";

import { setApplicationMaterialsReady } from "@/lib/applications/materials-ready-actions";
import { Button, Checklist, cn, type ChecklistItem } from "@/components/ui-v2";

const MATERIALS_LABEL = "Course materials";

export function DecisionReadinessChecklist({
  applicationId,
  items,
  canMarkMaterials,
}: {
  applicationId: string;
  items: ChecklistItem[];
  canMarkMaterials: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const materialsItem = items.find((item) => item.label === MATERIALS_LABEL);
  const otherItems = items.filter((item) => item.label !== MATERIALS_LABEL);

  async function toggleMaterials() {
    if (!materialsItem || pending) return;
    setPending(true);
    try {
      const result = await setApplicationMaterialsReady({
        applicationId,
        ready: !materialsItem.done,
      });
      if (result.success) {
        startTransition(() => {
          router.refresh();
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {materialsItem ? (
        <div className="flex items-start gap-2.5 rounded-[8px] bg-surface-soft px-3.5 py-2.5">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              materialsItem.done
                ? "bg-success-100 text-success-700"
                : "bg-warning-100 text-warning-700"
            )}
          >
            {materialsItem.done ? "✓" : "•"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13.5px] font-semibold text-ink">{materialsItem.label}</p>
            <p
              className={cn(
                "m-0 text-[12.5px]",
                materialsItem.done ? "text-ink-muted" : "font-medium text-warning-700"
              )}
            >
              {materialsItem.done
                ? "Marked as on file"
                : "Confirm when course outline and first-class plan are on file"}
            </p>
            {canMarkMaterials ? (
              <Button
                type="button"
                variant={materialsItem.done ? "secondary" : "primary"}
                size="sm"
                className="mt-2"
                disabled={pending}
                onClick={() => void toggleMaterials()}
              >
                {pending
                  ? "Saving…"
                  : materialsItem.done
                    ? "Mark as missing"
                    : "Mark materials on file"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {otherItems.length > 0 ? <Checklist items={otherItems} /> : null}
    </div>
  );
}
