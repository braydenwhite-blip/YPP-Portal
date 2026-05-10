import Link from "next/link";
import type {
  AdminClassOperationsListItem,
} from "@/lib/admin-class-operations";

type ProposalQueueItem = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  meetingDays: string[];
  meetingTime: string;
  deliveryMode: string;
  locationName: string | null;
  locationAddress: string | null;
  capacity: number;
  semester: string | null;
  instructor: { id: string; name: string; email: string } | null;
  chapter: { id: string; name: string } | null;
  template: {
    id: string;
    title: string;
    interestArea: string;
    difficultyLevel: string;
    targetAgeGroup: string | null;
  };
  approval: {
    status: string;
    requestedAt: Date | null;
    requestNotes: string | null;
    reviewNotes: string | null;
  } | null;
};

export default function ClassOperationsList({
  tab,
  operations,
  proposals,
}: {
  tab: string;
  operations: AdminClassOperationsListItem[];
  proposals: ProposalQueueItem[];
}) {
  if (tab === "review") {
    return <ProposalQueueView proposals={proposals} />;
  }

  const filtered = filterByTab(operations, tab);

  if (filtered.length === 0) {
    return <EmptyState tab={tab} />;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {filtered.map((offering) => (
        <OperationsRow key={offering.id} offering={offering} />
      ))}
    </div>
  );
}

function filterByTab(
  operations: AdminClassOperationsListItem[],
  tab: string,
): AdminClassOperationsListItem[] {
  switch (tab) {
    case "ready":
      return operations.filter((o) => o.actionFlags.approvedNotPublished);
    case "full":
      return operations.filter((o) => o.actionFlags.full || o.actionFlags.hasWaitlist);
    case "logistics":
      return operations.filter(
        (o) =>
          o.actionFlags.missingLocation ||
          o.actionFlags.missingMeetingLink ||
          o.actionFlags.missingInstructor,
      );
    case "archive":
      return operations.filter(
        (o) => o.actionFlags.isCancelled || o.actionFlags.isCompleted,
      );
    case "operations":
    default:
      return operations.filter(
        (o) => !o.actionFlags.isCancelled && !o.actionFlags.isCompleted,
      );
  }
}

function EmptyState({ tab }: { tab: string }) {
  const messages: Record<string, string> = {
    operations: "No active classes right now.",
    ready: "No classes are approved and waiting to publish.",
    full: "No classes are full or have a waitlist.",
    logistics: "All classes have their core logistics filled in.",
    archive: "No cancelled or completed classes yet.",
  };
  return (
    <div className="card">
      <p style={{ margin: 0, color: "var(--text-secondary)" }}>
        {messages[tab] ?? "No classes match this view."}
      </p>
    </div>
  );
}

function ProposalQueueView({ proposals }: { proposals: ProposalQueueItem[] }) {
  if (proposals.length === 0) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          No class proposals awaiting review.
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {proposals.map((proposal) => (
        <ProposalRow key={proposal.id} proposal={proposal} />
      ))}
    </div>
  );
}

function ProposalRow({ proposal }: { proposal: ProposalQueueItem }) {
  const status = proposal.approval?.status ?? "REQUESTED";
  return (
    <div className="card" style={{ borderLeft: `4px solid ${approvalColor(status)}` }}>
      <div style={rowHeader}>
        <div>
          <h3 style={{ margin: 0 }}>{proposal.title}</h3>
          <div style={metaText}>
            {proposal.instructor?.name ?? "No instructor"} ·{" "}
            {proposal.chapter?.name ?? "No chapter"} ·{" "}
            {proposal.template.interestArea} · {proposal.template.difficultyLevel}
          </div>
        </div>
        <ApprovalBadge status={status} />
      </div>

      <div style={pillRow}>
        <Pill>{proposal.deliveryMode.replace("_", " ")}</Pill>
        {proposal.template.targetAgeGroup && (
          <Pill>Ages {proposal.template.targetAgeGroup}</Pill>
        )}
        <Pill>Capacity {proposal.capacity}</Pill>
        {proposal.semester && <Pill>{proposal.semester}</Pill>}
        <Pill>
          Starts {proposal.startDate.toLocaleDateString()}
        </Pill>
        {proposal.deliveryMode === "IN_PERSON" && (
          <Pill>{proposal.locationName ?? "Location TBD"}</Pill>
        )}
        {proposal.approval?.requestedAt && (
          <Pill>Submitted {proposal.approval.requestedAt.toLocaleDateString()}</Pill>
        )}
      </div>

      {proposal.approval?.requestNotes && (
        <NoteBlock label="Instructor notes" body={proposal.approval.requestNotes} />
      )}
      {proposal.approval?.reviewNotes && (
        <NoteBlock label="Previous review notes" body={proposal.approval.reviewNotes} />
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/admin/classes/${proposal.id}/review`} className="button primary" style={{ fontSize: 13 }}>
          Review proposal
        </Link>
        <Link href={`/admin/classes/${proposal.id}`} className="button secondary" style={{ fontSize: 13 }}>
          View class
        </Link>
      </div>
    </div>
  );
}

function OperationsRow({ offering }: { offering: AdminClassOperationsListItem }) {
  const flags = offering.actionFlags;
  const hasAttention =
    flags.needsReview ||
    flags.needsRevision ||
    flags.approvedNotPublished ||
    flags.missingInstructor ||
    flags.missingLocation ||
    flags.missingMeetingLink ||
    flags.startsWithin7Days ||
    flags.full;

  return (
    <div className="card" style={hasAttention ? { borderLeft: "4px solid #b45309" } : undefined}>
      <div style={rowHeader}>
        <div>
          <h3 style={{ margin: 0 }}>
            <Link href={`/admin/classes/${offering.id}`} style={{ color: "inherit" }}>
              {offering.title}
            </Link>
          </h3>
          <div style={metaText}>
            {offering.instructor?.name ?? "No instructor"} ·{" "}
            {offering.chapter?.name ?? "No chapter"} ·{" "}
            {offering.template?.interestArea ?? "—"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <StatusBadge status={offering.status} />
          {offering.approval?.status && (
            <ApprovalBadge status={offering.approval.status} small />
          )}
        </div>
      </div>

      <div style={pillRow}>
        <Pill>{offering.deliveryMode.replace("_", " ")}</Pill>
        <Pill>
          Starts {offering.startDate.toLocaleDateString()}
        </Pill>
        <Pill>
          {offering.confirmedCount}/{offering.capacity} enrolled
          {offering.waitlistedCount > 0 ? ` · +${offering.waitlistedCount} waitlisted` : ""}
        </Pill>
        {offering.deliveryMode === "IN_PERSON" && (
          <Pill>{offering.locationName ?? "Location TBD"}</Pill>
        )}
        {offering.enrollmentOpen ? (
          <Pill tone="ok">Enrollment open</Pill>
        ) : (
          <Pill tone="muted">Enrollment closed</Pill>
        )}
      </div>

      {hasAttention && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {flags.needsReview && <FlagPill tone="warn">Awaiting review</FlagPill>}
          {flags.needsRevision && <FlagPill tone="warn">Revision requested</FlagPill>}
          {flags.approvedNotPublished && <FlagPill tone="info">Approved · not published</FlagPill>}
          {flags.missingInstructor && <FlagPill tone="bad">No instructor</FlagPill>}
          {flags.missingLocation && <FlagPill tone="bad">Missing location</FlagPill>}
          {flags.missingMeetingLink && <FlagPill tone="bad">Missing meeting link</FlagPill>}
          {flags.startsWithin7Days && <FlagPill tone="warn">Starts within 7 days</FlagPill>}
          {flags.full && <FlagPill tone="warn">At capacity</FlagPill>}
          {flags.noEnrollments && <FlagPill tone="muted">No signups yet</FlagPill>}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/admin/classes/${offering.id}`} className="button" style={{ fontSize: 12 }}>
          Open
        </Link>
        <Link href={`/admin/classes/${offering.id}/roster`} className="button" style={{ fontSize: 12 }}>
          Roster
        </Link>
        {(offering.approval?.status === "REQUESTED" ||
          offering.approval?.status === "UNDER_REVIEW" ||
          offering.approval?.status === "CHANGES_REQUESTED") && (
          <Link href={`/admin/classes/${offering.id}/review`} className="button primary" style={{ fontSize: 12 }}>
            Review
          </Link>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: "#e5e7eb", color: "#374151" },
    PUBLISHED: { bg: "#dcfce7", color: "#166534" },
    IN_PROGRESS: { bg: "#dbeafe", color: "#1e40af" },
    COMPLETED: { bg: "#f3e8ff", color: "#6b21a8" },
    CANCELLED: { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = palette[status] ?? { bg: "#e5e7eb", color: "#374151" };
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function ApprovalBadge({ status, small = false }: { status: string; small?: boolean }) {
  return (
    <span
      style={{
        padding: small ? "2px 8px" : "3px 10px",
        borderRadius: 999,
        fontSize: small ? 10 : 11,
        fontWeight: 700,
        color: "#fff",
        background: approvalColor(status),
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function approvalColor(status: string): string {
  switch (status) {
    case "APPROVED":
      return "#16a34a";
    case "REQUESTED":
    case "UNDER_REVIEW":
      return "#6b21c8";
    case "CHANGES_REQUESTED":
      return "#dc2626";
    case "REJECTED":
      return "#71717a";
    default:
      return "#6b7280";
  }
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "ok" | "muted" | "warn";
}) {
  const palette: Record<string, { bg: string; color: string }> = {
    ok: { bg: "#dcfce7", color: "#166534" },
    muted: { bg: "#f3f4f6", color: "#4b5563" },
    warn: { bg: "#fef3c7", color: "#854d0e" },
    default: { bg: "#f3f4f6", color: "#374151" },
  };
  const c = palette[tone ?? "default"];
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

function FlagPill({ children, tone }: { children: React.ReactNode; tone: "warn" | "bad" | "info" | "muted" }) {
  const palette: Record<string, { bg: string; color: string }> = {
    warn: { bg: "#fef3c7", color: "#854d0e" },
    bad: { bg: "#fee2e2", color: "#991b1b" },
    info: { bg: "#dbeafe", color: "#1e40af" },
    muted: { bg: "#f3f4f6", color: "#6b7280" },
  };
  const c = palette[tone];
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
      }}
    >
      {children}
    </span>
  );
}

function NoteBlock({ label, body }: { label: string; body: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "var(--surface-alt, #faf5ff)",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div>{body}</div>
    </div>
  );
}

const rowHeader: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "start",
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const metaText: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  marginTop: 4,
};

const pillRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 10,
};
