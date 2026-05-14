"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCourseLibraryStatus } from "@/lib/class-management-actions";

export function LibraryStatusActions({
  id,
  isCatalogItem,
  isPublished,
}: {
  id: string;
  isCatalogItem: boolean;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(next: { isCatalogItem: boolean; isPublished: boolean }) {
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("isCatalogItem", next.isCatalogItem ? "true" : "false");
    formData.set("isPublished", next.isPublished ? "true" : "false");
    startTransition(async () => {
      try {
        await setCourseLibraryStatus(formData);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {!isCatalogItem ? (
          <button
            type="button"
            className="button primary"
            disabled={pending}
            onClick={() => update({ isCatalogItem: true, isPublished: true })}
          >
            {pending ? "Promoting…" : "Promote to library"}
          </button>
        ) : isPublished ? (
          <>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() => update({ isCatalogItem: true, isPublished: false })}
            >
              {pending ? "Updating…" : "Move to draft"}
            </button>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() => update({ isCatalogItem: false, isPublished: false })}
            >
              Remove from library
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="button primary"
              disabled={pending}
              onClick={() => update({ isCatalogItem: true, isPublished: true })}
            >
              {pending ? "Publishing…" : "Publish to library"}
            </button>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() => update({ isCatalogItem: false, isPublished: false })}
            >
              Remove from library
            </button>
          </>
        )}
      </div>
      {error ? (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 12 }}>{error}</p>
      ) : null}
    </div>
  );
}
