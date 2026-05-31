import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  formatInstructorOpsDateTime,
  getInstructorOpsRecords,
  type AttentionTone,
  type InstructorAttentionFlag,
  type InstructorOpsRecord,
} from "@/lib/instructor-ops";

export const dynamic = "force-dynamic";

type AttentionItem = {
  id: string;
  record: InstructorOpsRecord;
  flag: InstructorAttentionFlag;
};

const TONE_ORDER: Record<AttentionTone, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export default async function InstructorAttentionPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const records = await getInstructorOpsRecords();
  const items = records
    .flatMap((record) =>
      record.attentionFlags.map((flag) => ({
        id: `${record.id}-${flag.kind}`,
        record,
        flag,
      }))
    )
    .toSorted((a, b) => {
      const toneDiff = TONE_ORDER[a.flag.tone] - TONE_ORDER[b.flag.tone];
      if (toneDiff !== 0) return toneDiff;
      return new Date(b.record.latestActivityAt).getTime() - new Date(a.record.latestActivityAt).getTime();
    });

  const counts = {
    critical: items.filter((item) => item.flag.tone === "critical").length,
    warning: items.filter((item) => item.flag.tone === "warning").length,
    info: items.filter((item) => item.flag.tone === "info").length,
  };

  return (
    <div className="instructor-ops-page instructor-attention-page">
      <div className="topbar">
        <div>
          <p className="badge">Admin | Attention Inbox</p>
          <h1 className="page-title">Instructor Attention Inbox</h1>
          <p className="page-subtitle">
            A single queue for stalled reviews, onboarding blockers, assignment
            issues, mentorship gaps, overload, and certification risk.
          </p>
        </div>
        <div className="instructor-ops-header-actions">
          <Link href="/admin/instructors/hub" className="button secondary">
            Pipeline hub
          </Link>
          <Link href="/admin/instructors" className="button">
            Database
          </Link>
        </div>
      </div>

      <div className="grid three instructor-ops-metrics">
        <CountCard label="Critical" value={counts.critical} tone="critical" />
        <CountCard label="Warning" value={counts.warning} tone="warning" />
        <CountCard label="Informational" value={counts.info} tone="info" />
      </div>

      <section className="card instructor-attention-rules">
        <h2>Rules Used For V1</h2>
        <p>
          This inbox is computed from current portal data. It flags old review
          assignments, stuck post-interview applications, unconfirmed interviews,
          onboarding blockers, pending or rejected class approvals, missing
          instructor mentors, ready instructors with no assignments, overload,
          and certification expiration windows.
        </p>
      </section>

      <section className="instructor-attention-list">
        {items.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No instructor attention items right now.
            </p>
          </div>
        ) : (
          items.map((item) => <AttentionRow key={item.id} item={item} />)
        )}
      </section>
    </div>
  );
}

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: AttentionTone;
}) {
  return (
    <div className={`card instructor-attention-count is-${tone}`}>
      <span className="kpi">{value}</span>
      <span className="kpi-label">{label}</span>
    </div>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const { record, flag } = item;
  return (
    <article className={`card instructor-attention-row is-${flag.tone}`}>
      <div>
        <div className="instructor-attention-row-title">
          <Link href={record.profileHref}>{record.name}</Link>
          <span className={`pill pill-small ${flag.tone === "critical" ? "pill-attention" : "pill-purple"}`}>
            {flag.tone}
          </span>
          <span className="pill pill-small">{record.stageLabel}</span>
        </div>
        <p>{record.email} | {record.chapterName}</p>
        <div className="instructor-attention-flag-copy">
          <strong>{flag.title}</strong>
          <span>{flag.detail}</span>
        </div>
        <div className="instructor-ops-tag-row">
          {record.tags.slice(0, 6).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>

      <div className="instructor-attention-row-meta">
        <span>Latest activity</span>
        <strong>{formatInstructorOpsDateTime(record.latestActivityAt)}</strong>
        <span>{record.latestActivityLabel}</span>
      </div>

      <div className="instructor-attention-row-actions">
        <Link href={flag.href} className="button small">
          Open action
        </Link>
        <Link href={record.profileHref} className="button small secondary">
          Profile
        </Link>
      </div>
    </article>
  );
}
