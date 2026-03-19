import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import {
  addMentorCommitteeMember,
  createMentorCommittee,
  createMentorshipTrack,
  updateMentorshipGovernance,
} from "@/lib/mentorship-program-actions";
import { assignSupportCircleMember } from "@/lib/mentorship-hub-actions";
import {
  ADMIN_MENTORSHIP_LANE_META,
  ADMIN_MENTORSHIP_LANES,
  getAdminMentorshipLaneForUser,
  parseAdminMentorshipLane,
  toLaneQueryValue,
} from "@/lib/mentorship-admin-helpers";
import { getAdminMentorshipCommandCenterData } from "@/lib/admin-mentorship-command-center";

import ChairsPanel from "./chairs-panel";
import GoalsPanel from "./goals-panel";
import MatchingPanel from "./matching-panel";

export const metadata = { title: "Mentorship Command Center — Admin" };

type SearchParams = {
  lane?: string;
  focus?: string;
  menteeId?: string;
  supportRole?: string;
};

type MatchSupportRole =
  | "PRIMARY_MENTOR"
  | "CHAIR"
  | "SPECIALIST_MENTOR"
  | "COLLEGE_ADVISOR"
  | "ALUMNI_ADVISOR";

function parseFocus(raw?: string) {
  if (
    raw === "queue" ||
    raw === "matching" ||
    raw === "staffing" ||
    raw === "governance"
  ) {
    return raw;
  }

  return "queue";
}

function parseSupportRole(raw?: string): MatchSupportRole {
  if (
    raw === "PRIMARY_MENTOR" ||
    raw === "CHAIR" ||
    raw === "SPECIALIST_MENTOR" ||
    raw === "COLLEGE_ADVISOR" ||
    raw === "ALUMNI_ADVISOR"
  ) {
    return raw;
  }

  return "PRIMARY_MENTOR";
}

function getFocusCardStyle(isActive: boolean) {
  return {
    border: isActive
      ? "1px solid rgba(59, 130, 246, 0.35)"
      : "1px solid var(--border)",
    boxShadow: isActive ? "0 0 0 3px rgba(59, 130, 246, 0.08)" : "none",
  };
}

export default async function MentorshipProgramAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const lane = parseAdminMentorshipLane(searchParams.lane);
  const focus = parseFocus(searchParams.focus);
  const supportRole = parseSupportRole(searchParams.supportRole);
  const data = await getAdminMentorshipCommandCenterData();

  const laneMeta = ADMIN_MENTORSHIP_LANE_META[lane];
  const selectedSummary =
    data.laneSummaries.find((summary) => summary.lane === lane) ??
    data.laneSummaries[0];
  const laneWatchlist = data.watchlist.filter((item) => item.lane === lane);
  const laneCircles = data.circleSummaries.filter((circle) => circle.lane === lane);
  const laneRequests = data.requestSummaries.filter((request) => request.lane === lane);
  const laneUnassigned = data.unassignedMentees.filter(
    (mentee) => mentee.lane === lane
  );
  const laneMentorships = data.mentorships.filter((mentorship) => {
    const mentorshipLane = getAdminMentorshipLaneForUser({
      primaryRole: mentorship.mentee.primaryRole,
      roles: mentorship.mentee.roles.map((role) => role.role),
    });
    return mentorshipLane === lane;
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Mentorship Command Center</h1>
          <p className="page-subtitle">
            One place to watch risk, build shortlists, staff support circles,
            and keep review routing clean across students, instructors, and
            leadership.
          </p>
        </div>
      </div>

      <MentorshipGuideCard
        title="How This Command Center Works"
        intro="This page is organized around the real admin jobs in the mentorship system so you can move from signal to action without switching between separate products."
        items={[
          {
            label: "Queue / Watchlist",
            meaning:
              "This is the early-warning layer. It shows who still needs a primary mentor, where circles are under-staffed, where cadence is slipping, and where support requests are waiting.",
            howToUse:
              "Start here first. If something looks risky, use the action button on that card so you land in the right next step instead of hunting through tabs.",
          },
          {
            label: "Matching",
            meaning:
              "Matching is decision support, not auto-assignment. You get a ranked shortlist with fit reasons and staffing context.",
            howToUse:
              "Use it when someone needs a primary mentor or another circle role. Compare the shortlist, then approve the best option when it feels right.",
          },
          {
            label: "Circle Staffing",
            meaning:
              "This is where you add or replace support roles after the primary mentor is chosen.",
            howToUse:
              "Use the staffing form for direct assignments, then scan the circle cards below it to see what roles are filled and what gaps still remain.",
          },
          {
            label: "Governance",
            meaning:
              "Governance keeps tracks, chairs, committees, goals, and review routing aligned with the newer mentorship workflow.",
            howToUse:
              "Use this area when the problem is structural rather than person-level, like chair coverage, track setup, or review routing cleanup.",
          },
        ]}
      />

      <div
        className="card"
        style={{ marginBottom: 24, background: "var(--surface-alt)" }}
      >
        <div className="section-title" style={{ marginBottom: 10 }}>
          Population Lanes
        </div>
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13 }}>
          Keep unlike cases separate. Each lane keeps its own workload, watchlist,
          staffing defaults, and review rhythm.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {ADMIN_MENTORSHIP_LANES.map((laneOption) => {
            const summary =
              data.laneSummaries.find((item) => item.lane === laneOption) ??
              selectedSummary;
            const isSelected = laneOption === lane;

            return (
              <Link
                key={laneOption}
                href={`/admin/mentorship-program?lane=${toLaneQueryValue(
                  laneOption
                )}&focus=${focus}`}
                className="card"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  border: isSelected
                    ? "1px solid rgba(59, 130, 246, 0.35)"
                    : "1px solid var(--border)",
                  boxShadow: isSelected
                    ? "0 0 0 3px rgba(59, 130, 246, 0.08)"
                    : "none",
                  background: isSelected ? "rgba(59, 130, 246, 0.04)" : "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <strong>{ADMIN_MENTORSHIP_LANE_META[laneOption].label}</strong>
                  {isSelected ? <span className="pill pill-small">Current lane</span> : null}
                </div>
                <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
                  {ADMIN_MENTORSHIP_LANE_META[laneOption].staffingExpectation}
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  <div>
                    <strong style={{ color: "var(--foreground)" }}>
                      {summary.activeCircles}
                    </strong>{" "}
                    active circles
                  </div>
                  <div>
                    <strong style={{ color: "var(--foreground)" }}>
                      {summary.peopleNeedingPrimaryMentor}
                    </strong>{" "}
                    unstaffed
                  </div>
                  <div>
                    <strong style={{ color: "var(--foreground)" }}>
                      {summary.staffingGaps}
                    </strong>{" "}
                    staffing gaps
                  </div>
                  <div>
                    <strong style={{ color: "var(--foreground)" }}>
                      {summary.openRequests}
                    </strong>{" "}
                    open requests
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <div className="card">
          <p className="kpi">{selectedSummary.activeCircles}</p>
          <p className="kpi-label">{laneMeta.shortLabel} active circles</p>
        </div>
        <div className="card">
          <p className="kpi">{selectedSummary.peopleNeedingPrimaryMentor}</p>
          <p className="kpi-label">Need primary mentor</p>
        </div>
        <div className="card">
          <p className="kpi">{selectedSummary.staffingGaps}</p>
          <p className="kpi-label">Circle staffing gaps</p>
        </div>
        <div className="card">
          <p className="kpi">{selectedSummary.pendingReviews}</p>
          <p className="kpi-label">Chair approvals pending</p>
        </div>
        <div className="card">
          <p className="kpi">{selectedSummary.openRequests}</p>
          <p className="kpi-label">Open support requests</p>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title">Program-wide signal</div>
          <p className="kpi" style={{ marginBottom: 4 }}>
            {data.analytics.pendingChairReviews}
          </p>
          <p className="kpi-label">reviews waiting on chair approval</p>
        </div>
        <div className="card">
          <div className="section-title">Approved this month</div>
          <p className="kpi" style={{ marginBottom: 4 }}>
            {data.analytics.approvedThisMonth}
          </p>
          <p className="kpi-label">reviews published this month</p>
        </div>
        <div className="card">
          <div className="section-title">Resource commons</div>
          <p className="kpi" style={{ marginBottom: 4 }}>
            {data.analytics.publishedResources}
          </p>
          <p className="kpi-label">published mentorship resources</p>
        </div>
      </div>

      <section
        id="queue"
        className="card"
        style={{ marginBottom: 24, ...getFocusCardStyle(focus === "queue") }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <div className="section-title">Queue / Watchlist</div>
            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
              Start here to see what needs attention in the {laneMeta.label.toLowerCase()} lane.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href={`/admin/mentorship-program?lane=${toLaneQueryValue(
                lane
              )}&focus=matching#matching`}
              className="button secondary small"
            >
              Open matching
            </Link>
            <Link
              href={`/admin/mentorship-program?lane=${toLaneQueryValue(
                lane
              )}&focus=staffing#staffing`}
              className="button secondary small"
            >
              Open staffing
            </Link>
          </div>
        </div>

        <div className="grid two" style={{ marginBottom: 20 }}>
          <div
            style={{
              padding: 14,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-alt)",
            }}
          >
            <div className="section-title" style={{ marginBottom: 8 }}>
              Lane expectations
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              {laneMeta.description}
            </p>
          </div>
          <div
            style={{
              padding: 14,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-alt)",
            }}
          >
            <div className="section-title" style={{ marginBottom: 8 }}>
              What the counts mean
            </div>
            <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: 13 }}>
              A good lane has low unstaffed counts, low staffing gaps, and a clean
              chair-approval queue.
            </p>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              If a card below feels urgent, use its action button so you land in
              the correct next step.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {laneWatchlist.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border)",
                color: "var(--muted)",
              }}
            >
              No watchlist items are active in this lane right now.
            </div>
          ) : (
            laneWatchlist.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  padding: 16,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "white",
                }}
              >
                <div style={{ flex: 1, minWidth: 240 }}>
                  <strong>{item.title}</strong>
                  <p style={{ margin: "6px 0 8px", color: "var(--muted)", fontSize: 13 }}>
                    {item.description}
                  </p>
                  <span className="pill pill-small pill-pending">{item.emphasis}</span>
                </div>
                <div style={{ alignSelf: "center" }}>
                  <Link href={item.actionHref} className="button primary small">
                    {item.actionLabel}
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        <div id="requests" style={{ marginTop: 24 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>
            Open Requests ({laneRequests.length})
          </div>
          {laneRequests.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No open support requests are waiting in this lane.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {laneRequests.map((request) => (
                <div
                  key={request.id}
                  style={{
                    padding: 14,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-alt)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{request.title}</strong>
                      <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                        {request.menteeName} · {request.kind.toLowerCase()}
                        {request.trackName ? ` · ${request.trackName}` : ""}
                      </p>
                    </div>
                    <Link href={request.actionHref} className="button secondary small">
                      Open circle
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        id="matching"
        className="card"
        style={{ marginBottom: 24, ...getFocusCardStyle(focus === "matching") }}
      >
        <div className="section-title" style={{ marginBottom: 8 }}>
          Matching
        </div>
        <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
          Use shortlist matching when someone needs a new assignment decision. The
          system ranks candidates, but you still make the call.
        </p>
        <MatchingPanel
          key={`${lane}-${focus}-${supportRole}-${searchParams.menteeId ?? "all"}`}
          initialLane={lane}
          initialSupportRole={supportRole}
          initialMenteeId={searchParams.menteeId}
          autoRun={focus === "matching" || Boolean(searchParams.menteeId)}
        />
      </section>

      <section
        id="staffing"
        className="card"
        style={{ marginBottom: 24, ...getFocusCardStyle(focus === "staffing") }}
      >
        <div className="section-title" style={{ marginBottom: 8 }}>
          Circle Staffing
        </div>
        <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
          Use this when the primary mentor already exists and you need to add or
          replace support roles around that circle.
        </p>

        <div className="grid two" style={{ marginBottom: 20 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>
              Add Or Replace A Support Role
            </div>
            <form action={assignSupportCircleMember} className="form-grid">
              <div className="form-row">
                <label>Mentee</label>
                <select name="menteeId" className="input" required>
                  <option value="">Select active circle...</option>
                  {laneCircles.map((circle) => (
                    <option key={circle.menteeId} value={circle.menteeId}>
                      {circle.menteeName} ({circle.menteeRole.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Supporter</label>
                <select name="userId" className="input" required>
                  <option value="">Select user...</option>
                  {data.governanceUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.roles.map((role) => role.role).join(", ")})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Role</label>
                <select name="role" className="input" defaultValue="SPECIALIST_MENTOR">
                  <option value="PRIMARY_MENTOR">Primary mentor</option>
                  <option value="CHAIR">Chair</option>
                  <option value="SPECIALIST_MENTOR">Specialist mentor</option>
                  <option value="COLLEGE_ADVISOR">College advisor</option>
                  <option value="ALUMNI_ADVISOR">Alumni advisor</option>
                  <option value="PEER_SUPPORT">Peer support</option>
                </select>
              </div>
              <div className="form-row">
                <label>Notes</label>
                <textarea
                  name="notes"
                  className="input"
                  rows={3}
                  placeholder="Explain why this person is being added to the circle."
                />
              </div>
              <button type="submit" className="button primary small">
                Save staffing change
              </button>
            </form>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>
              How To Use Staffing
            </div>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 13 }}>
              Use matching for primary mentor gaps. Use staffing once the circle exists
              and you need to fill missing chairs, specialist roles, or advisors.
            </p>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 13 }}>
              The cards below show whether each lane circle already has the minimum
              coverage the command center expects.
            </p>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              {laneMeta.staffingExpectation}
            </p>
          </div>
        </div>

        {laneCircles.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--border)",
              color: "var(--muted)",
            }}
          >
            There are no active circles in this lane yet. If people are waiting,
            use matching to assign a primary mentor first.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {laneCircles.map((circle) => (
              <div
                key={circle.mentorshipId}
                style={{
                  padding: 16,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface-alt)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <strong>{circle.menteeName}</strong>
                    <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                      {circle.menteeRole.replace(/_/g, " ")} · Mentor: {circle.mentorName}
                      {circle.trackName ? ` · ${circle.trackName}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {circle.latestReviewLabel ? (
                      <span className={`pill pill-small ${circle.latestReviewToneClass ?? ""}`}>
                        {circle.latestReviewLabel}
                      </span>
                    ) : (
                      <span className="pill pill-small">No monthly review yet</span>
                    )}
                    <Link
                      href={`/mentorship/mentees/${circle.menteeId}`}
                      className="button secondary small"
                    >
                      Open circle
                    </Link>
                  </div>
                </div>

                <div className="grid two">
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--muted)",
                        marginBottom: 8,
                      }}
                    >
                      Roles already filled
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {circle.currentRoles.map((role) => (
                        <span key={role} className="pill pill-small pill-success">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--muted)",
                        marginBottom: 8,
                      }}
                    >
                      Gaps still open
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {circle.missingRoles.length > 0 ? (
                        circle.missingRoles.map((role) => (
                          <span key={role} className="pill pill-small pill-pending">
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="pill pill-small pill-success">
                          Watchlist coverage looks complete
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        id="governance"
        className="card"
        style={{ marginBottom: 24, ...getFocusCardStyle(focus === "governance") }}
      >
        <div className="section-title" style={{ marginBottom: 8 }}>
          Governance
        </div>
        <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
          Governance keeps the structural parts of mentorship aligned: tracks,
          chairs, committees, goals, and review routing.
        </p>

        <div className="grid two" style={{ marginBottom: 24 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="section-title">Create Mentorship Track</div>
            <form action={createMentorshipTrack} className="form-grid">
              <div className="form-row">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  className="input"
                  required
                  placeholder="Leadership Mentorship"
                />
              </div>
              <div className="form-row">
                <label>Slug</label>
                <input
                  type="text"
                  name="slug"
                  className="input"
                  required
                  placeholder="leadership-mentorship"
                />
              </div>
              <div className="form-row">
                <label>Description</label>
                <textarea name="description" className="input" rows={3} />
              </div>
              <div className="form-row">
                <label>Scope</label>
                <select name="scope" className="input" defaultValue="GLOBAL">
                  <option value="GLOBAL">Global</option>
                  <option value="CHAPTER">Chapter</option>
                </select>
              </div>
              <div className="form-row">
                <label>Point Category</label>
                <select name="pointCategory" className="input" defaultValue="CUSTOM">
                  <option value="CUSTOM">Custom / No Auto Points</option>
                  <option value="STUDENT">Student</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="CHAPTER_PRESIDENT">Chapter President</option>
                  <option value="GLOBAL_LEADERSHIP">Global Leadership</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
              <button type="submit" className="button">
                Create track
              </button>
            </form>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="section-title">Create Mentor Committee</div>
            <form action={createMentorCommittee} className="form-grid">
              <div className="form-row">
                <label>Track</label>
                <select name="trackId" className="input" required>
                  <option value="">Select track...</option>
                  {data.tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Committee name</label>
                <input
                  type="text"
                  name="name"
                  className="input"
                  required
                  placeholder="Leadership Review Committee"
                />
              </div>
              <div className="form-row">
                <label>Description</label>
                <textarea name="description" className="input" rows={3} />
              </div>
              <div className="form-row">
                <label>Chair</label>
                <select name="chairUserId" className="input">
                  <option value="">No chair yet</option>
                  {data.governanceUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="button secondary">
                Create committee
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Committee Membership</div>
          <form
            action={addMentorCommitteeMember}
            className="grid three"
            style={{ alignItems: "end" }}
          >
            <div className="form-row">
              <label>Committee</label>
              <select name="committeeId" className="input" required>
                <option value="">Select committee...</option>
                {data.committees.map((committee) => (
                  <option key={committee.id} value={committee.id}>
                    {committee.track.name} · {committee.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>User</label>
              <select name="userId" className="input" required>
                <option value="">Select user...</option>
                {data.governanceUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.roles.map((role) => role.role).join(", ")})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Committee role</label>
              <select name="role" className="input" defaultValue="MEMBER">
                <option value="MEMBER">Member</option>
                <option value="CHAIR">Chair</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
            <button type="submit" className="button">
              Add or update member
            </button>
          </form>
        </div>

        <div className="grid two" style={{ marginBottom: 24 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>
              Committee Chairs
            </div>
            <ChairsPanel chairs={data.chairs} eligibleUsers={data.governanceUsers} />
          </div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>
              Program Goals
            </div>
            <GoalsPanel goals={data.goals} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>
            Mentorship Tracks
          </div>
          {data.tracks.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No mentorship tracks exist yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {data.tracks.map((track) => (
                <div
                  key={track.id}
                  style={{
                    padding: 16,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-alt)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{track.name}</strong>
                      <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                        {track.scope} · {track.pointCategory.replace(/_/g, " ")} ·{" "}
                        {track._count.mentorships} active circles
                      </p>
                      {track.description ? (
                        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                          {track.description}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`pill ${track.isActive ? "pill-success" : "pill-declined"}`}
                    >
                      {track.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>
            Review Routing And Circle Governance
          </div>
          {laneMentorships.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No active circles in this lane yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {laneMentorships.map((mentorship) => (
                <form
                  key={mentorship.id}
                  action={updateMentorshipGovernance}
                  style={{
                    padding: 16,
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <input type="hidden" name="mentorshipId" value={mentorship.id} />
                  <div style={{ marginBottom: 12 }}>
                    <strong>{mentorship.mentee.name}</strong>
                    <span style={{ color: "var(--muted)" }}>
                      {" "}· Mentor: {mentorship.mentor.name} ·{" "}
                      {mentorship.mentee.primaryRole.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="grid four" style={{ alignItems: "end" }}>
                    <div className="form-row">
                      <label>Track</label>
                      <select name="trackId" className="input" defaultValue={mentorship.trackId ?? ""}>
                        <option value="">No track</option>
                        {data.tracks.map((track) => (
                          <option key={track.id} value={track.id}>
                            {track.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label>Chair</label>
                      <select name="chairId" className="input" defaultValue={mentorship.chairId ?? ""}>
                        <option value="">No chair</option>
                        {data.governanceUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label>Kickoff scheduled</label>
                      <input
                        type="date"
                        name="kickoffScheduledAt"
                        className="input"
                        defaultValue={
                          mentorship.kickoffScheduledAt
                            ? mentorship.kickoffScheduledAt.toISOString().slice(0, 10)
                            : ""
                        }
                      />
                    </div>
                    <div className="form-row">
                      <label>Kickoff completed</label>
                      <input
                        type="date"
                        name="kickoffCompletedAt"
                        className="input"
                        defaultValue={
                          mentorship.kickoffCompletedAt
                            ? mentorship.kickoffCompletedAt.toISOString().slice(0, 10)
                            : ""
                        }
                      />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <label>Routing notes</label>
                    <textarea
                      name="notes"
                      className="input"
                      rows={3}
                      defaultValue={mentorship.notes ?? ""}
                      placeholder="Use this for committee context, kickoff notes, or review-routing details."
                    />
                  </div>
                  <button type="submit" className="button small" style={{ marginTop: 12 }}>
                    Save governance
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      </section>

      {laneUnassigned.length > 0 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>
            Waiting For A Primary Mentor ({laneUnassigned.length})
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {laneUnassigned.map((mentee) => (
              <div
                key={mentee.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: 14,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface-alt)",
                }}
              >
                <div>
                  <strong>{mentee.name}</strong>
                  <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                    {mentee.primaryRole.replace(/_/g, " ")}
                    {mentee.chapterName ? ` · ${mentee.chapterName}` : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/mentorship-program?lane=${toLaneQueryValue(
                    lane
                  )}&focus=matching&menteeId=${mentee.id}&supportRole=PRIMARY_MENTOR#matching`}
                  className="button primary small"
                >
                  Find primary mentor
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
