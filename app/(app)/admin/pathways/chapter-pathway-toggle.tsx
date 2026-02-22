"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateChapterPathwayConfig } from "@/lib/chapter-pathway-actions";

interface ChapterPathwayToggleProps {
  chapterId: string;
  pathwayId: string;
  isAvailable: boolean;
  isFeatured: boolean;
}

export function ChapterPathwayToggle({ chapterId, pathwayId, isAvailable, isFeatured }: ChapterPathwayToggleProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(field: "isAvailable" | "isFeatured", value: boolean) {
    startTransition(async () => {
      await updateChapterPathwayConfig({ chapterId, pathwayId, [field]: value });
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140, flexShrink: 0 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => toggle("isAvailable", e.target.checked)}
          disabled={isPending}
        />
        Available
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => toggle("isFeatured", e.target.checked)}
          disabled={isPending || !isAvailable}
        />
        Featured
      </label>
      {isPending && <span style={{ fontSize: 12, color: "var(--gray-400)" }}>Saving...</span>}
    </div>
  );
}
