"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { activateGRDocument } from "@/lib/gr-actions";

export function ActivateGRButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          const fd = new FormData();
          fd.set("documentId", documentId);
          startTransition(async () => {
            try {
              await activateGRDocument(fd);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not activate");
            }
          });
        }}
      >
        {pending ? "Activating…" : "Make visible to mentee"}
      </Button>
      {error ? <p className="m-0 text-[12px] text-red-600">{error}</p> : null}
    </div>
  );
}
