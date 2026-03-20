"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateChapterPathwayConfig } from "@/lib/chapter-pathway-actions";
import { ChapterPathwayRunStatus } from "@prisma/client";
import { CHAPTER_RUN_STATUS_OPTIONS } from "./pathway-run-metadata";

interface ChapterPathwayToggleProps {
  chapterId: string;
  pathwayId: string;
  isAvailable: boolean;
  isFeatured: boolean;
  runStatus: ChapterPathwayRunStatus;
  ownerId: string | null;
  displayOrder: number;
  ownerOptions: Array<{
    id: string;
    name: string;
    primaryRole: string;
  }>;
}

export function ChapterPathwayToggle({
  chapterId,
  pathwayId,
  isAvailable,
  isFeatured,
  runStatus,
  ownerId,
  displayOrder,
  ownerOptions,
}: ChapterPathwayToggleProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleAvailability(value: boolean) {
    startTransition(async () => {
      await updateChapterPathwayConfig({ chapterId, pathwayId, isAvailable: value });
      router.refresh();
    });
  }

  function toggleFeatured(value: boolean) {
    startTransition(async () => {
      await updateChapterPathwayConfig({ chapterId, pathwayId, isFeatured: value });
      router.refresh();
    });
  }

  function toggleRunStatus(value: ChapterPathwayRunStatus) {
    startTransition(async () => {
      await updateChapterPathwayConfig({ chapterId, pathwayId, runStatus: value });
      router.refresh();
    });
  }

  function toggleOwner(value: string | null) {
    startTransition(async () => {
      await updateChapterPathwayConfig({ chapterId, pathwayId, ownerId: value });
      router.refresh();
    });
  }

  function toggleDisplayOrder(value: number) {
    startTransition(async () => {
      await updateChapterPathwayConfig({ chapterId, pathwayId, displayOrder: value });
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 240, flexShrink: 0 }}>
      <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Chapter run</span>
        <select
          className="input"
          value={runStatus}
          onChange={(event) => toggleRunStatus(event.target.value as ChapterPathwayRunStatus)}
          disabled={isPending}
        >
          {CHAPTER_RUN_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Owner</span>
        <select
          className="input"
          value={ownerId ?? ""}
          onChange={(event) => toggleOwner(event.target.value || null)}
          disabled={isPending}
        >
          <option value="">No owner assigned</option>
          {ownerOptions.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name} · {owner.primaryRole.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Display order</span>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          value={Number.isFinite(displayOrder) ? displayOrder : 0}
          onChange={(event) => toggleDisplayOrder(Number(event.target.value || 0))}
          disabled={isPending}
        />
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(event) => toggleAvailability(event.target.checked)}
          disabled={isPending}
        />
        Visible in chapter
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(event) => toggleFeatured(event.target.checked)}
          disabled={isPending || !isAvailable}
        />
        Featured first
      </label>

      <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
        {CHAPTER_RUN_STATUS_OPTIONS.find((option) => option.value === runStatus)?.description}
      </div>

      {isPending && <span style={{ fontSize: 12, color: "var(--gray-400)" }}>Saving changes...</span>}
    </div>
  );
}
