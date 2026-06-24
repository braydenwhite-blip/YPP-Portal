"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createChapterFromApplication } from "@/lib/chapters/actions";

// Spins up a PROSPECT chapter pre-filled from the application and assigns it, so
// approving the CP flows straight into a launching chapter — no re-entry.
export function CreateChapterFromApplicationButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="button secondary small"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await createChapterFromApplication({ applicationId });
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not create the chapter.");
            }
          })
        }
      >
        {pending ? "Creating chapter…" : "Create chapter from this application"}
      </button>
      {error && <p style={{ color: "#b91c1c", fontSize: 12, margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}
