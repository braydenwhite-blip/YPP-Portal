"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui-v2";

export function ArchiveAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const first = window.prompt(
      "This will archive EVERY applicant submission across all five submission tables (instructor, application, chapter-president, incubator, internship). Type ARCHIVE ALL to confirm."
    );
    if (first !== "ARCHIVE ALL") return;

    setBusy(true);
    try {
      const res = await fetch("/api/admin/applicants/archive-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "admin-ui-archive-all" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || "Failed to archive");
        return;
      }
      const total = data?.counts?.total ?? 0;
      alert(`Archived ${total} applicant submission${total === 1 ? "" : "s"}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      loading={busy}
      variant="secondary"
      size="sm"
      aria-label="Archive every applicant submission across all submission types"
    >
      {busy ? "Archiving..." : "Archive All"}
    </Button>
  );
}

export function ArchiveOneButton({
  applicationId,
  kind = "instructor",
  applicantName,
  onArchived,
}: {
  applicationId: string;
  kind?: "instructor" | "application" | "chapter-president" | "incubator" | "internship";
  applicantName?: string | null;
  onArchived?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const who = applicantName ? ` for ${applicantName}` : "";
    if (!window.confirm(`Archive this application${who}? It will be hidden from the pipeline and moved to the Archive tab.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/applicants/${kind}/${applicationId}/archive`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || "Failed to archive");
        return;
      }
      onArchived?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      loading={busy}
      variant="secondary"
      size="sm"
      aria-label="Archive this application"
    >
      {busy ? "Archiving..." : "Archive"}
    </Button>
  );
}
