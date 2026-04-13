import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import ContextTrail from "@/components/context-trail";
import { buildContextTrail } from "@/lib/context-trail";
import { formatEnum } from "@/lib/format-utils";
import { updateMentorshipActionItemStatus } from "@/lib/mentorship-hub-actions";
import { getMyProgramHubData } from "@/lib/my-program-portal";
import { DeadlineChip } from "@/components/mentorship/deadline-chip";

export const metadata = { title: "My Program" };

const SUPPORT_OPERATOR_ROLES = new Set([
  "MENTOR",
  "CHAPTER_PRESIDENT",
  "ADMIN",
]);

const NOTICE_COPY: Record<string, { title: string; body: string }> = {
  "my-mentor-moved": {
    title: "My Support Circle moved",
    body: "Your support tools now live inside My Program so your next step, reflections, awards, and rewards stay together.",
  },
  "support-hub-moved": {
    title: "Student support now starts in My Program",
    body: "Mentorship is now the operator workspace. As a student, your support, action items, reflections, awards, and prizes all start here.",
  },
};

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "Not yet";
  return new Date(date).toLocaleDateString();
}

function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "Not scheduled yet";
  return new Date(date).toLocaleString();
}

export default async function MyProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { notice: noticeKey } = await searchParams;
  const roles = session.user.roles ?? [];
  const hub = await getMyProgramHubData({
    userId: session.user.id,
    primaryRole: session.user.primaryRole ?? null,
    roles,
  });

  if (!hub) {
    if (roles.some((role) => SUPPORT_OPERATOR_ROLES.has(role))) {
      redirect("/mentorship");
    }
    redirect("/");
  }

  let trailItems: Awaited<ReturnType<typeof buildContextTrail>> = [];
  try {
    trailItems = await buildContextTrail({ route: "/my-program", userId: session.user.id });
  } catch {
    trailItems = [];
  }

  const notice = noticeKey ? NOTICE_COPY[noticeKey] ?? null : null;
  const support = hub.support;
  const nextSession =
    support?.sessions.find((sessionItem) => !sessionItem.completedAt && sessionItem.scheduledAt.getTime() >= Date.now()) ??
    null;
  const openActionItems = support?.actionItems.filter((item) => item.status !== "COMPLETE") ?? [];
  const openRequests = support?.requests.filter((request) => request.status === "OPEN") ?? [];
  const recentResources = support?.resources.slice(0, 3) ?? [];

  const primaryIsAskMentor =
    hub.primaryAction.href === "/mentor/ask" || hub.primaryAction.href.startsWith("/mentor/ask?");
  const topbarMentorSecondary =
    hub.flags.hasSupportCircle
      ? { href: "/mentor/resources" as const, label: "Open Resources" as const }
      : primaryIsAskMentor
        ? { href: "/mentor/resources" as const, label: "Browse Resources" as const }
        : { href: "/mentor/ask" as const, label: "Ask A Mentor" as const };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Program</p>
          <h1 className="page-title">My Program</h1>
          <p className="page-subtitle">
            One front door for support, reflections, action items, awards, rewards, and prize status.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={hub.primaryAction.href} className="button primary small">
            {hub.primaryAction.label}
          </Link>
          <Link href={topbarMentorSecondary.href} className="button secondary small">
            {topbarMentorSecondary.label}
          </Link>
          <Link href="/rewards" className="button secondary small">
            Rewards
          </Link>
        </div>
      </div>

      {notice ? (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: "4px solid var(--ypp-purple)",
            background: "var(--ypp-purple-50, #faf5ff)",
          }}
        >
          <strong>{notice.title}</strong>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{notice.body}</p>
        </div>
      ) : null}

      <ContextTrail items={trailItems} />

      {hub.flags.isProgramParticipant && hub.programReflection?.available && (() => {
        const pr = hub.programReflection!;
        const now = new Date();
        const currentMonthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const latest = pr.latestReflection;
        const latestIsThisMonth =
          latest &&
          new Date(latest.cycleMonth).getFullYear() === now.getFullYear() &&
          new Date(latest.cycleMonth).getMonth() === now.getMonth();

        if (!latestIsThisMonth) {
          // Reflection not yet submitted this cycle
          return (
            <div
              className="card"
              style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                borderLeft: "4px solid #6366f1",
                background: "linear-gradient(135deg, #eef2ff 0%, #f8f9ff 100%)",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  Your {currentMonthLabel} self-reflection is due
                  <DeadlineChip
                    softDeadline={new Date(now.getFullYear(), now.getMonth(), 21)}
                  />
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                  Cycle {pr.nextCycle} &middot; Submit before the end of the month so your mentor can write your review on time.
                </p>
              </div>
              <Link href="/my-program/reflect" className="button primary small" style={{ whiteSpace: "nowrap" }}>
                Start Reflection →
              </Link>
            </div>
          );
        }

        if (latest && !latest.hasReleasedReview) {
          // Submitted, awaiting mentor review
          return (
            <div
              className="card"
              style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                borderLeft: "4px solid #22c55e",
                background: "linear-gradient(135deg, #f0fdf4 0%, #f8fff9 100%)",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {currentMonthLabel} reflection submitted ✓
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                  Cycle {latest.cycleNumber} &middot; Waiting on your mentor&apos;s review.
                </p>
              </div>
            </div>
          );
        }

        if (latest?.hasReleasedReview) {
          // Review released — link to it
          return (
            <div
              className="card"
              style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                borderLeft: "4px solid #3b82f6",
                background: "linear-gradient(135deg, #eff6ff 0%, #f8faff 100%)",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Your {currentMonthLabel} review is available
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                  Cycle {latest.cycleNumber} &middot; Your mentor&apos;s review has been released.
                </p>
              </div>
              <Link href={`/my-program/reflect/${latest.id}`} className="button secondary small" style={{ whiteSpace: "nowrap" }}>
                View Review →
              </Link>
            </div>
          );
        }

        return null;
      })()}

      <section className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ maxWidth: 700 }}>
            <div className="section-title">Top Next Step</div>
            <h2 style={{ margin: "8px 0 10px" }}>{hub.primaryAction.label}</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>{hub.primaryAction.detail}</p>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Support stays practical here: {openActionItems.length} open action item
              {openActionItems.length === 1 ? "" : "s"}, {openRequests.length} open request
              {openRequests.length === 1 ? "" : "s"}, and {hub.recognition.rewards.pendingCount} reward
              {hub.recognition.rewards.pendingCount === 1 ? "" : "s"} waiting.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={hub.primaryAction.href} className="button primary small">
              {hub.primaryAction.label}
            </Link>
            {hub.flags.isProgramParticipant ? (
              <Link href="/my-program/schedule" className="button secondary small">
                Schedule Check-In
              </Link>
            ) : (
              <Link href="/reflection" className="button secondary small">
                Reflection Center
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid three" style={{ marginBottom: 24 }}>
        <section className="card" id="support">
          <div className="section-title">Support</div>
          {support?.mentorship ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <strong>Lead support:</strong> {support.mentorship.mentor.name}
              </div>
              <div>
                <strong>Track:</strong> {support.mentorship.track?.name ?? "General support"}
              </div>
              <div>
                <strong>Next session:</strong> {formatDateTime(nextSession?.scheduledAt)}
              </div>
              <div>
                <strong>Circle members:</strong> {support.circleMembers.length}
              </div>
              <div>
                <strong>Current review:</strong>{" "}
                {support.currentReview?.status ? formatEnum(support.currentReview.status) : "No review started yet"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <Link href="/mentor/resources" className="button secondary small">
                  Open Resources
                </Link>
                <Link href="/mentor/feedback" className="button secondary small">
                  Request Feedback
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                No active support circle is assigned yet. You can still ask for help, submit reflections, and track recognition here.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href="/mentor/ask" className="button primary small">
                  Ask A Mentor
                </Link>
                <Link href="/mentor/resources" className="button secondary small">
                  Browse Resources
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-title">Reflection &amp; Review</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {hub.studentReflection ? (
              <div>
                <strong>{hub.studentReflection.formTitle}</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  {hub.studentReflection.currentStateLabel} · {hub.studentReflection.submissionsCount} submission
                  {hub.studentReflection.submissionsCount === 1 ? "" : "s"} on file
                </p>
                {hub.studentReflection.latestSubmission ? (
                  <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                    Latest: {formatDate(hub.studentReflection.latestSubmission.submittedAt)}
                  </p>
                ) : null}
                <div style={{ marginTop: 8 }}>
                  <Link href={hub.studentReflection.primaryHref} className="button secondary small">
                    {hub.studentReflection.primaryLabel}
                  </Link>
                </div>
              </div>
            ) : null}

            {hub.programReflection ? (
              <div style={{ paddingTop: hub.studentReflection ? 12 : 0, borderTop: hub.studentReflection ? "1px solid var(--border)" : "none" }}>
                <strong>{hub.programReflection.roleLabel} program loop</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  {hub.programReflection.reflectionsCount} reflection cycle
                  {hub.programReflection.reflectionsCount === 1 ? "" : "s"} completed ·{" "}
                  {hub.programReflection.releasedReviewsCount} released review
                  {hub.programReflection.releasedReviewsCount === 1 ? "" : "s"}
                </p>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  Mentor: {hub.programReflection.mentorName ?? "Not assigned"} · Next cycle: {hub.programReflection.nextCycle}
                  {hub.programReflection.isQuarterlyNext ? " (quarterly)" : ""}
                </p>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={hub.programReflection.primaryHref} className="button secondary small">
                    {hub.programReflection.primaryLabel}
                  </Link>
                  <Link href="/my-program/awards" className="button secondary small">
                    Program Awards
                  </Link>
                </div>
              </div>
            ) : null}

            {!hub.studentReflection && !hub.programReflection ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Reflection tools will appear here when your role has an active support or program cycle attached.
              </p>
            ) : null}
          </div>
        </section>

        <section className="card">
          <div className="section-title">Recognition &amp; Rewards</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <strong>{hub.recognition.badges.count}</strong> badge{hub.recognition.badges.count === 1 ? "" : "s"} ·{" "}
              <strong>{hub.recognition.awards.count}</strong> award{hub.recognition.awards.count === 1 ? "" : "s"} ·{" "}
              <strong>{hub.recognition.certificates.count}</strong> certificate
              {hub.recognition.certificates.count === 1 ? "" : "s"}
            </div>
            <div>
              <strong>{hub.recognition.rewards.pendingCount}</strong> reward
              {hub.recognition.rewards.pendingCount === 1 ? "" : "s"} ready ·{" "}
              <strong>{hub.recognition.rewards.unopenedBoxesCount}</strong> unopened prize box
              {hub.recognition.rewards.unopenedBoxesCount === 1 ? "" : "es"}
            </div>
            {hub.recognition.rewards.latestPendingLabel ? (
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                Next reward waiting: {hub.recognition.rewards.latestPendingLabel}
              </p>
            ) : null}
            {hub.flags.isProgramParticipant ? (
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                {hub.recognition.program.totalPoints} program points ·{" "}
                {hub.recognition.program.currentTier
                  ? `${formatEnum(hub.recognition.program.currentTier)} tier`
                  : "No tier yet"}{" "}
                · {hub.recognition.program.pendingNominationsCount} pending nomination
                {hub.recognition.program.pendingNominationsCount === 1 ? "" : "s"}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <Link href="/awards" className="button secondary small">
                Awards
              </Link>
              <Link href="/badges" className="button secondary small">
                Badges
              </Link>
              <Link href="/certificates" className="button secondary small">
                Certificates
              </Link>
              <Link href="/rewards" className="button secondary small">
                Rewards
              </Link>
              {hub.flags.isProgramParticipant ? (
                <Link href="/my-program/achievement-journey" className="button secondary small">
                  Journey
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="card" id="action-plan" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Action Plan</div>
        {openActionItems.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No active action items right now. Your next steps will show up here after support sessions and review cycles.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {openActionItems.map((item) => (
              <div key={item.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {item.owner?.name ? `Owner: ${item.owner.name}` : "Shared responsibility"} ·{" "}
                      {formatEnum(item.status)}
                      {item.dueAt ? ` · Due ${formatDate(item.dueAt)}` : ""}
                    </div>
                  </div>
                  <form action={updateMentorshipActionItemStatus}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="status" value="COMPLETE" />
                    <button type="submit" className="button secondary small">
                      Mark Complete
                    </button>
                  </form>
                </div>
                {item.details ? <p style={{ margin: "8px 0 0", fontSize: 13 }}>{item.details}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <div className="section-title">Upcoming Sessions &amp; Requests</div>
          {support?.mentorship ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <strong>Upcoming sessions</strong>
                {nextSession ? (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    {support.sessions
                      .filter((sessionItem) => !sessionItem.completedAt && sessionItem.scheduledAt.getTime() >= Date.now())
                      .slice(0, 3)
                      .map((sessionItem) => (
                        <div key={sessionItem.id}>
                          <div style={{ fontWeight: 600 }}>{sessionItem.title}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {formatDateTime(sessionItem.scheduledAt)} · {formatEnum(sessionItem.type)}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>No session is scheduled yet.</p>
                )}
              </div>

              <div>
                <strong>Open requests</strong>
                {openRequests.length > 0 ? (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    {openRequests.slice(0, 3).map((request) => (
                      <div key={request.id}>
                        <div style={{ fontWeight: 600 }}>{request.title}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {formatEnum(request.kind)} · {request.assignedTo?.name ? `Assigned to ${request.assignedTo.name}` : "Open to supporters"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>No open requests right now.</p>
                )}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Once a support circle is active, your next meetings and open help requests will show up here.
            </p>
          )}
        </section>

        <section className="card">
          <div className="section-title">Recognition Details</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <strong>Latest wins</strong>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                Badge: {hub.recognition.badges.latest?.name ?? "None yet"} · Award:{" "}
                {hub.recognition.awards.latest?.name ?? "None yet"} · Certificate:{" "}
                {hub.recognition.certificates.latest?.title ?? "None yet"}
              </p>
            </div>
            <div>
              <strong>Rewards and prizes</strong>
              <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                This hub shows eligibility, waiting rewards, and unopened prize boxes. Claim and redemption details still live on the dedicated rewards pages.
              </p>
            </div>
            {recentResources.length > 0 ? (
              <div>
                <strong>Shared resources</strong>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentResources.map((resource) => (
                    <div key={resource.id}>
                      <div style={{ fontWeight: 600 }}>{resource.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {formatEnum(resource.type)} · Shared by {resource.createdBy.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {hub.flags.isProgramParticipant ? (
        <div className="grid two">
          <section className="card">
            <div className="section-title">Program Goals</div>
            {hub.programReflection?.goals.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {hub.programReflection.goals.map((goal) => (
                  <div key={goal.id}>
                    <div style={{ fontWeight: 700 }}>{goal.title}</div>
                    {goal.description ? (
                      <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>{goal.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--muted)", margin: 0 }}>
                Program goals will appear here when your mentorship-program track is active.
              </p>
            )}
          </section>

          <section className="card">
            <div className="section-title">Program Review Snapshot</div>
            {hub.programReflection?.latestReflection ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <strong>Latest cycle:</strong> {hub.programReflection.latestReflection.cycleNumber}
                </div>
                <div>
                  <strong>Submitted:</strong> {formatDate(hub.programReflection.latestReflection.submittedAt)}
                </div>
                <div>
                  <strong>Released review:</strong>{" "}
                  {hub.programReflection.latestReflection.hasReleasedReview ? "Yes" : "Not yet"}
                </div>
                {hub.programReflection.latestReflection.pointsAwarded != null ? (
                  <div>
                    <strong>Points awarded:</strong> {hub.programReflection.latestReflection.pointsAwarded}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/my-program/reflect" className="button secondary small">
                    Open Reflection Flow
                  </Link>
                  <Link href="/my-program/certificate" className="button secondary small">
                    Certificate
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ color: "var(--muted)", margin: 0 }}>
                  Your first program reflection will start the review history that appears here.
                </p>
                <Link href="/my-program/reflect" className="button secondary small" style={{ width: "fit-content" }}>
                  Start First Reflection
                </Link>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
