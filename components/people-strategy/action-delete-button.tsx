"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteActionItem } from "@/lib/people-strategy/action-items-actions";

export function ActionDeleteButton({
  actionId,
  redirectTo,
  className = "button outline small",
  label = "Remove",
}: {
  actionId: string;
  redirectTo: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        "Remove this action? It will disappear from open lists but stay in history as dropped."
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteActionItem(actionId);
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not remove that action.");
      }
    });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={pending}
      style={className.includes("danger") ? undefined : { color: "var(--error-color)" }}
    >
      {pending ? "Removing…" : label}
    </button>
  );
}
