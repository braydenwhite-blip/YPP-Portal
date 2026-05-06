"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCurrent = currentSource === path;

  function handleSelect() {
    if (disabled) return;
    setError(null);
    const fd = new FormData();
    fd.set("sourceType", path);
    startTransition(async () => {
      try {
        await chooseWorkshopPath(fd);
        router.push(continueHref);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not switch paths."
        );
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
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="button secondary"
        onClick={handleSelect}
        disabled={disabled || isPending}
      >
        {isPending ? "Switching…" : "Pick this path"}
      </button>
      {error ? (
        <p
          role="alert"
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "#dc2626",
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
