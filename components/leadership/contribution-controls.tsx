"use client";

// Client controls for a single leadership contribution: status changes and
// activity logging. Used on /my-leadership (instructor acting on their own
// role) and the admin instructor profile / leadership dashboard.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadershipContributionStatus } from "@prisma/client";
import {
  logContributionActivity,
  updateContributionStatus,
  deleteContribution,
} from "@/lib/leadership/contribution-actions";
import {
  CONTRIBUTION_ACTIVITY_KINDS,
  CONTRIBUTION_ACTIVITY_KIND_LABELS,
  CONTRIBUTION_STATUS_META,
  type ContributionActivityKind,
} from "@/lib/leadership/constants";

const STATUS_OPTIONS = Object.keys(
  CONTRIBUTION_STATUS_META,
) as LeadershipContributionStatus[];

export function ContributionStatusSelect({
  contributionId,
  status,
}: {
  contributionId: string;
  status: LeadershipContributionStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value as LeadershipContributionStatus;
        startTransition(async () => {
          await updateContributionStatus(contributionId, next);
          router.refresh();
        });
      }}
      style={{ fontSize: 12, padding: "3px 6px", borderRadius: 6 }}
      aria-label="Contribution status"
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {CONTRIBUTION_STATUS_META[option].label}
        </option>
      ))}
    </select>
  );
}

export function LogActivityForm({ contributionId }: { contributionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ContributionActivityKind>("NOTE");
  const [body, setBody] = useState("");

  if (!open) {
    return (
      <button
        className="button secondary small"
        onClick={() => setOpen(true)}
        style={{ fontSize: 12 }}
      >
        + Log activity
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
      <select
        value={kind}
        onChange={(event) => setKind(event.target.value as ContributionActivityKind)}
        style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, maxWidth: 220 }}
        aria-label="Activity kind"
      >
        {CONTRIBUTION_ACTIVITY_KINDS.filter((k) => k !== "STATUS_CHANGE").map((k) => (
          <option key={k} value={k}>
            {CONTRIBUTION_ACTIVITY_KIND_LABELS[k]}
          </option>
        ))}
      </select>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        placeholder="What happened? Check-ins, feedback given, interviews completed, evidence…"
        style={{ fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="button small"
          disabled={isPending || body.trim().length === 0}
          onClick={() => {
            startTransition(async () => {
              await logContributionActivity({ contributionId, kind, body });
              setBody("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button className="button ghost small" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DeleteContributionButton({ contributionId }: { contributionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="button ghost small" style={{ fontSize: 12 }} onClick={() => setConfirming(true)}>
        Remove
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button
        className="button small"
        style={{ fontSize: 12, background: "#dc2626" }}
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await deleteContribution(contributionId);
            router.refresh();
          });
        }}
      >
        {isPending ? "Removing…" : "Confirm remove"}
      </button>
      <button className="button ghost small" style={{ fontSize: 12 }} onClick={() => setConfirming(false)}>
        Keep
      </button>
    </span>
  );
}
