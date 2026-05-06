"use client";

import Link from "next/link";
import { useTransition } from "react";
import { chooseWorkshopPath } from "@/lib/workshop-proposal-actions";
import type { WorkshopProposalSourceType } from "@prisma/client";

type ChooseWorkshopPathButtonsProps = {
  currentSource: WorkshopProposalSourceType | null;
  path: WorkshopProposalSourceType;
  continueHref: string;
  disabled?: boolean;
};

export function ChooseWorkshopPathButtons({
  currentSource,
  path,
  continueHref,
  disabled = false,
}: ChooseWorkshopPathButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const isCurrent = currentSource === path;

  function handleSelect() {
    if (disabled) return;
    const fd = new FormData();
    fd.set("sourceType", path);
    startTransition(async () => {
      try {
        await chooseWorkshopPath(fd);
        window.location.href = continueHref;
      } catch (err) {
        // Surface the action's error to the user — server validates again.
        const message =
          err instanceof Error ? err.message : "Could not switch paths.";
        alert(message);
      }
    });
  }

  if (isCurrent) {
    return (
      <Link
        href={continueHref}
        className="button"
        style={{ marginTop: 8, textDecoration: "none", display: "inline-block" }}
        aria-disabled={disabled}
      >
        Continue
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="button secondary"
      onClick={handleSelect}
      disabled={disabled || isPending}
      style={{ marginTop: 8 }}
    >
      {isPending ? "Switching…" : "Pick this path"}
    </button>
  );
}
