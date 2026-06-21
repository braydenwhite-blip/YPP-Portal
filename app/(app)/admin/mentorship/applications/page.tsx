import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { hasAnyRole, OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import { MENTORSHIP_APPLICATION_STATUS_LABELS } from "@/lib/mentorship-2/constants";
import {
  getApplicationsQueue,
  type ApplicationQueueBucket,
  type ApplicationQueueItem,
} from "@/lib/mentorship-2/recommendations/queries";
import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";
import { EmptySimpleState, PrimaryFocusCard } from "@/components/command-center/simple";

export const metadata = { title: "Mentorship matching queue — YPP" };

const BUCKETS: { bucket: ApplicationQueueBucket; label: string; hint: string }[] = [
  { bucket: "new", label: "New", hint: "Just submitted — generate recommendations to start matching." },
  { bucket: "needsRecommendations", label: "Needs recommendations", hint: "In review with no live recommendations." },
  { bucket: "hasRecommendations", label: "Has recommendations", hint: "Scored mentors waiting on a decision." },
  { bucket: "shortlisted", label: "Shortlisted", hint: "A finalist mentor is shortlisted." },
  { bucket: "held", label: "Held", hint: "Parked for later." },
  { bucket: "matched", label: "Approved / matched", hint: "An active match has been approved." },
  { bucket: "closed", label: "Closed", hint: "Declined or withdrawn." },
];

export default async function MentorshipApplicationsPage() {
  if (!isMentorship2Enabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (
    !hasAnyRole(
      session.user.roles ?? [],
      [...OFFICER_TIER_ROLES],
      session.user.primaryRole ?? null
    )
  ) {
    redirect("/");
  }

  const queue = await getApplicationsQueue();
  const byBucket = new Map<ApplicationQueueBucket, ApplicationQueueItem[]>();
  for (const item of queue) {
    const list = byBucket.get(item.bucket) ?? [];
    list.push(item);
    byBucket.set(item.bucket, list);
  }

  const openItems = queue.filter(
    (i) => i.bucket !== "matched" && i.bucket !== "closed"
  );
  const openCount = openItems.length;

  // The single application Calm leads with: the most actionable open one
  // (something just submitted or in review with no live recs first), so an
  // officer always has one obvious next match to work.
  const focusItem =
    openItems.find((i) => i.bucket === "new" || i.bucket === "needsRecommendations") ??
    openItems.find((i) => i.bucket === "hasRecommendations") ??
    openItems.find((i) => i.bucket === "shortlisted") ??
    openItems[0] ??
    null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Matching queue</h1>
          <p className="page-subtitle">
            Mentee applications grouped by stage. Open one to generate scored
            mentor recommendations and approve a match.
          </p>
        </div>
        <Link href="/admin/mentorship" className="button secondary small">
          ← Mentorship oversight
        </Link>
      </div>

      {queue.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>
          No mentorship applications yet.
        </p>
      ) : (
        <>
          <CalmOnly>
            <div style={{ marginBottom: 20 }}>
              {focusItem ? (
                <PrimaryFocusCard
                  eyebrow="Match next"
                  icon="users"
                  title={`Match ${focusItem.applicantName ?? focusItem.applicantEmail}`}
                  reason={focusReason(focusItem.bucket)}
                  ctaLabel="Open application"
                  ctaHref={`/admin/mentorship/applications/${focusItem.id}`}
                />
              ) : (
                <EmptySimpleState icon="check">
                  No applications are waiting on a match right now.
                </EmptySimpleState>
              )}
            </div>
          </CalmOnly>

          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            {openCount} open · {queue.length} total
          </p>
          <CalmCollapse label="All applications by stage" hint="every bucket, grouped">
          <div style={{ display: "grid", gap: 28 }}>
            {BUCKETS.map(({ bucket, label, hint }) => {
              const items = byBucket.get(bucket) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={bucket}>
                  <h2 style={{ margin: "0 0 2px", fontSize: 15 }}>
                    {label}{" "}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      ({items.length})
                    </span>
                  </h2>
                  <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
                    {hint}
                  </p>
                  <div style={{ display: "grid", gap: 10 }}>
                    {items.map((item) => (
                      <ApplicationRowLink key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          </CalmCollapse>
        </>
      )}
    </div>
  );
}

/** Plain-language reason a given open bucket is the next thing to work. */
function focusReason(bucket: ApplicationQueueBucket): string {
  switch (bucket) {
    case "new":
      return "Just submitted — generate scored recommendations to start matching.";
    case "needsRecommendations":
      return "In review with no live recommendations — generate them.";
    case "hasRecommendations":
      return "Scored mentors are waiting on your decision.";
    case "shortlisted":
      return "A finalist is shortlisted — approve to pair them.";
    case "held":
      return "Parked earlier — revisit when you're ready.";
    default:
      return "Open this application to continue matching.";
  }
}

function ApplicationRowLink({ item }: { item: ApplicationQueueItem }) {
  return (
    <Link
      href={`/admin/mentorship/applications/${item.id}`}
      className="card"
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div>
        <strong>{item.applicantName ?? item.applicantEmail}</strong>
        <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
          {item.applicantEmail} · applied{" "}
          {new Date(item.createdAt).toLocaleDateString()}
        </p>
        {item.goals && (
          <p style={{ margin: "6px 0 0", fontSize: 13, maxWidth: "60ch" }}>
            {item.goals.length > 140 ? `${item.goals.slice(0, 140)}…` : item.goals}
          </p>
        )}
      </div>
      <div style={{ textAlign: "right", display: "grid", gap: 4, justifyItems: "end" }}>
        <span className="pill">{MENTORSHIP_APPLICATION_STATUS_LABELS[item.status]}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {summaryLine(item)}
        </span>
      </div>
    </Link>
  );
}

function summaryLine(item: ApplicationQueueItem): string {
  const { summary, bucket } = item;
  if (bucket === "matched") return "Active match approved";
  if (bucket === "closed") return "Closed";
  const live = summary.suggested + summary.shortlisted + summary.held;
  if (live === 0) return "No recommendations yet";
  const top = summary.topScore != null ? ` · top ${summary.topScore}` : "";
  return `${live} live recommendation${live === 1 ? "" : "s"}${top}`;
}
