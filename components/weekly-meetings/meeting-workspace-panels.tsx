"use client";

import Link from "next/link";

import { CardV2, cn } from "@/components/ui-v2";
import {
  assessMeetingWorkspace,
  MEETING_WORKSPACE_FIELDS,
  workspaceCompletionPercent,
} from "@/lib/weekly-meetings/meeting-workspace";
import type { MeetingDetail } from "@/lib/weekly-meetings/meetings";

export function MeetingWorkspaceChecklist({ meeting }: { meeting: MeetingDetail }) {
  const checks = assessMeetingWorkspace(meeting);
  const pct = workspaceCompletionPercent(checks);

  return (
    <CardV2 padding="md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">Partner meeting workspace</h2>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
            Agenda · proposal · notes · follow-ups · next steps · owner · partner · outcome
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-bold",
            pct >= 80 ? "bg-success-100 text-success-800" : pct >= 50 ? "bg-progress-100 text-progress-800" : "bg-blocked-100 text-blocked-800",
          )}
        >
          {pct}% complete
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {checks.map((c) => (
          <div
            key={c.key}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-[12px]",
              c.complete ? "border-success-200 bg-success-50/60 text-success-900" : "border-line-soft bg-surface-soft text-ink-muted",
            )}
          >
            <span className="font-semibold">{c.complete ? "✓" : "○"} {c.label}</span>
            {c.detail ? <p className="m-0 mt-0.5 truncate text-[11px] opacity-80">{c.detail}</p> : null}
          </div>
        ))}
      </div>
      <p className="m-0 mt-3 text-[11.5px] text-ink-muted">
        {MEETING_WORKSPACE_FIELDS.filter((f) => !checks.find((c) => c.key === f.key)?.complete)
          .slice(0, 3)
          .map((f) => f.hint)
          .join(" · ")}
      </p>
    </CardV2>
  );
}

export function PartnerMeetingContextPanel({
  partner,
}: {
  partner: NonNullable<MeetingDetail["partnerDetail"]>;
}) {
  return (
    <CardV2 padding="md">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">Linked partner — CRM</h2>
          <p className="m-0 mt-0.5 text-[13px] text-ink">
            <Link href={`/partners/${partner.id}`} className="font-semibold text-brand-700 hover:underline">
              {partner.name}
            </Link>
            {partner.type ? <span className="text-ink-muted"> · {partner.type}</span> : null}
          </p>
        </div>
        <span className="rounded-full border border-line-soft bg-surface-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {partner.statusLabel}
        </span>
      </div>
      <div className="grid gap-2 text-[12.5px] sm:grid-cols-2">
        {partner.contactName ? (
          <p className="m-0">
            <b className="text-ink">Contact:</b> {partner.contactName}
            {partner.contactTitle ? ` (${partner.contactTitle})` : ""}
          </p>
        ) : null}
        {partner.nextFollowUpAt ? (
          <p className="m-0">
            <b className="text-ink">Next follow-up:</b>{" "}
            {new Date(partner.nextFollowUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        ) : (
          <p className="m-0 text-blocked-700">
            <b>No follow-up scheduled</b> — set one in Partner CRM
          </p>
        )}
        {partner.relationshipLeadName ? (
          <p className="m-0">
            <b className="text-ink">Relationship lead:</b> {partner.relationshipLeadName}
          </p>
        ) : null}
      </div>
      {partner.notes ? (
        <p className="m-0 mt-3 rounded-lg border border-line-soft bg-surface-soft px-3 py-2 text-[12.5px] text-ink-muted">
          {partner.notes.slice(0, 280)}
          {partner.notes.length > 280 ? "…" : ""}
        </p>
      ) : null}
    </CardV2>
  );
}
