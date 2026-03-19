"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  ADMIN_MENTORSHIP_LANE_META,
  ADMIN_MENTORSHIP_LANES,
  type AdminMentorshipLane,
} from "@/lib/mentorship-admin-helpers";
import {
  approveMentorMatch,
  computeMentorMatches,
  type MentorMatchGroup,
} from "@/lib/mentor-match-actions";
import { SUPPORT_ROLE_META } from "@/lib/mentorship-hub";

type MatchSupportRole =
  | "PRIMARY_MENTOR"
  | "CHAIR"
  | "SPECIALIST_MENTOR"
  | "COLLEGE_ADVISOR"
  | "ALUMNI_ADVISOR";

const SUPPORT_ROLE_OPTIONS: Array<{
  value: MatchSupportRole;
  label: string;
  help: string;
}> = [
  {
    value: "PRIMARY_MENTOR",
    label: "Primary mentor",
    help: "Use this when someone does not have a lead mentor yet.",
  },
  {
    value: "CHAIR",
    label: "Committee chair",
    help: "Use this when review routing or escalation coverage is missing.",
  },
  {
    value: "SPECIALIST_MENTOR",
    label: "Specialist mentor",
    help: "Use this when the circle needs subject-specific support.",
  },
  {
    value: "COLLEGE_ADVISOR",
    label: "College advisor",
    help: "Use this when future planning or college guidance is the gap.",
  },
  {
    value: "ALUMNI_ADVISOR",
    label: "Alumni advisor",
    help: "Use this when lived experience and next-step perspective would help.",
  },
];

function getScoreColor(score: number) {
  if (score >= 70) return "pill-success";
  if (score >= 40) return "";
  return "pill-pending";
}

export default function MatchingPanel({
  initialLane,
  initialSupportRole,
  initialMenteeId,
  autoRun,
}: {
  initialLane: AdminMentorshipLane;
  initialSupportRole: MatchSupportRole;
  initialMenteeId?: string | null;
  autoRun?: boolean;
}) {
  const [lane, setLane] = useState<AdminMentorshipLane>(initialLane);
  const [supportRole, setSupportRole] =
    useState<MatchSupportRole>(initialSupportRole);
  const [menteeFilter, setMenteeFilter] = useState(initialMenteeId ?? "");
  const [groups, setGroups] = useState<MentorMatchGroup[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const didAutoRun = useRef(false);

  function runMatch(args?: {
    lane?: AdminMentorshipLane;
    supportRole?: MatchSupportRole;
    menteeId?: string;
  }) {
    const nextLane = args?.lane ?? lane;
    const nextSupportRole = args?.supportRole ?? supportRole;
    const nextMenteeId = args?.menteeId ?? menteeFilter;

    setError(null);
    startTransition(async () => {
      try {
        const results = await computeMentorMatches(
          nextLane,
          nextSupportRole,
          nextMenteeId || undefined
        );
        setGroups(results);
        setHasRun(true);
        setApprovedKeys(new Set());
      } catch (matchError) {
        setError(
          matchError instanceof Error
            ? matchError.message
            : "Could not build shortlist suggestions."
        );
      }
    });
  }

  function handleApprove(group: MentorMatchGroup, mentorId: string) {
    const candidate = group.candidates.find((item) => item.mentorId === mentorId);
    if (!candidate) {
      return;
    }

    const formData = new FormData();
    formData.set("mentorId", candidate.mentorId);
    formData.set("menteeId", candidate.menteeId);
    formData.set("type", candidate.type);
    formData.set("supportRole", candidate.supportRole);

    setError(null);
    startTransition(async () => {
      try {
        await approveMentorMatch(formData);
        setApprovedKeys((current) => {
          const next = new Set(current);
          next.add(`${group.menteeId}-${group.supportRole}`);
          return next;
        });
      } catch (approvalError) {
        setError(
          approvalError instanceof Error
            ? approvalError.message
            : "Could not approve the assignment."
        );
      }
    });
  }

  useEffect(() => {
    if (!autoRun || didAutoRun.current) {
      return;
    }

    didAutoRun.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const results = await computeMentorMatches(
          initialLane,
          initialSupportRole,
          initialMenteeId || undefined
        );
        setGroups(results);
        setHasRun(true);
        setApprovedKeys(new Set());
      } catch (matchError) {
        setError(
          matchError instanceof Error
            ? matchError.message
            : "Could not build shortlist suggestions."
        );
      }
    });
  }, [autoRun, initialLane, initialMenteeId, initialSupportRole]);

  const selectedSupportRole =
    SUPPORT_ROLE_OPTIONS.find((option) => option.value === supportRole) ??
    SUPPORT_ROLE_OPTIONS[0];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>
          Shortlist Matching
        </div>
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13 }}>
          This tool does not auto-assign people. It builds a ranked shortlist so
          you can compare fit, load, chapter affinity, and circle context before
          you choose.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
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
              Population lane
            </div>
            <div className="mentor-match-type-toggle">
              {ADMIN_MENTORSHIP_LANES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`mentor-match-type-btn ${
                    lane === option ? "active" : ""
                  }`}
                  onClick={() => {
                    setLane(option);
                    setHasRun(false);
                    setGroups([]);
                    setApprovedKeys(new Set());
                    setError(null);
                  }}
                >
                  {ADMIN_MENTORSHIP_LANE_META[option].shortLabel}
                </button>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12 }}>
              {ADMIN_MENTORSHIP_LANE_META[lane].description}
            </p>
          </div>

          <div className="grid two" style={{ alignItems: "start" }}>
            <div className="form-row" style={{ margin: 0 }}>
              <label>Role you are trying to fill</label>
              <select
                className="input"
                value={supportRole}
                onChange={(event) => {
                  setSupportRole(event.target.value as MatchSupportRole);
                  setHasRun(false);
                  setGroups([]);
                  setApprovedKeys(new Set());
                  setError(null);
                }}
              >
                {SUPPORT_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 12 }}>
                {selectedSupportRole.help}
              </p>
            </div>

            <div className="form-row" style={{ margin: 0 }}>
              <label>Optional mentee focus</label>
              <div
                style={{
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface-alt)",
                  color: menteeFilter ? "var(--foreground)" : "var(--muted)",
                  fontSize: 13,
                }}
              >
                {menteeFilter
                  ? "Showing a shortlist for one person from a watchlist action."
                  : "No single person is locked in. Running this will score the full lane."}
              </div>
              {menteeFilter ? (
                <button
                  type="button"
                  className="button ghost small"
                  style={{ width: "fit-content", marginTop: 8 }}
                  onClick={() => setMenteeFilter("")}
                >
                  Show whole lane instead
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <p style={{ color: "var(--color-error)", margin: "12px 0 0" }}>{error}</p>
        ) : null}

        <button
          type="button"
          className="button primary"
          onClick={() => runMatch()}
          disabled={isPending}
          style={{ marginTop: 16 }}
        >
          {isPending ? "Building shortlist..." : "Build shortlist"}
        </button>
      </div>

      {hasRun ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div className="section-title">
            Shortlist Results ({groups.length})
          </div>

          {groups.length === 0 ? (
            <div className="card">
              <p className="empty">
                No eligible mentees were found for this lane and role right now.
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const approvalKey = `${group.menteeId}-${group.supportRole}`;
              const isApproved = approvedKeys.has(approvalKey);

              return (
                <div key={approvalKey} className="card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {group.menteeName}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        {group.menteeRole.replace(/_/g, " ")} · {group.menteeEmail}
                        {group.menteeChapter ? ` · ${group.menteeChapter}` : ""}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                        {group.currentMentorName
                          ? `Current mentor: ${group.currentMentorName}`
                          : "No primary mentor assigned yet"}
                        {group.currentTrackName ? ` · ${group.currentTrackName}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="pill pill-small">
                        {SUPPORT_ROLE_META[group.supportRole as keyof typeof SUPPORT_ROLE_META]
                          ?.label ?? group.supportRole.replace(/_/g, " ")}
                      </span>
                      <span className="pill pill-small">
                        {group.candidates.length} option{group.candidates.length === 1 ? "" : "s"}
                      </span>
                      {isApproved ? (
                        <span className="pill pill-success">Assignment approved</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid two" style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                        background: "var(--surface-alt)",
                      }}
                    >
                      <div className="section-title" style={{ marginBottom: 8 }}>
                        Current circle
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {group.currentRoles.length > 0 ? (
                          group.currentRoles.map((role) => (
                            <span key={role} className="pill pill-small pill-success">
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="pill pill-small">No roles assigned yet</span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 14,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                        background: "#fff7ed",
                      }}
                    >
                      <div className="section-title" style={{ marginBottom: 8 }}>
                        Gaps still visible
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {group.missingRoles.length > 0 ? (
                          group.missingRoles.map((gap) => (
                            <span key={gap} className="pill pill-small pill-pending">
                              {gap}
                            </span>
                          ))
                        ) : (
                          <span className="pill pill-small pill-success">
                            No watchlist gaps right now
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12 }}>
                        If you approve one {selectedSupportRole.label.toLowerCase()}, the
                        remaining gaps would be{" "}
                        {group.remainingGapsAfterApproval.length > 0
                          ? group.remainingGapsAfterApproval.join(", ").toLowerCase()
                          : "fully covered for the current watchlist roles"}
                        .
                      </p>
                    </div>
                  </div>

                  {group.candidates.length === 0 ? (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: "var(--radius-md)",
                        border: "1px dashed var(--border)",
                        color: "var(--muted)",
                        fontSize: 13,
                      }}
                    >
                      No shortlist candidates were available yet for this person in
                      the selected role.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {group.candidates.map((candidate) => (
                        <div
                          key={`${candidate.menteeId}-${candidate.mentorId}-${candidate.supportRole}`}
                          className={`mentor-match-card ${isApproved ? "approved" : ""}`}
                          style={{ margin: 0 }}
                        >
                          <div className="mentor-match-card-header">
                            <span className={`pill ${getScoreColor(candidate.matchScore)}`}>
                              Score: {candidate.matchScore}
                            </span>
                            <span className="pill pill-small">
                              {candidate.mentorCurrentMentees} active assignment
                              {candidate.mentorCurrentMentees === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="mentor-match-pair">
                            <div className="mentor-match-person">
                              <div className="mentor-match-person-label">Candidate</div>
                              <div className="mentor-match-person-name">
                                {candidate.mentorName}
                              </div>
                              <div className="mentor-match-person-email">
                                {candidate.mentorEmail}
                              </div>
                              {candidate.mentorChapter ? (
                                <div className="mentor-match-person-detail">
                                  Chapter: {candidate.mentorChapter}
                                </div>
                              ) : null}
                              {candidate.mentorAvailability ? (
                                <div className="mentor-match-person-detail">
                                  Availability: {candidate.mentorAvailability}
                                </div>
                              ) : null}
                              {candidate.mentorInterests.length > 0 ? (
                                <div className="mentor-match-interests">
                                  {candidate.mentorInterests.slice(0, 4).map((interest) => (
                                    <span
                                      key={interest}
                                      className="pill pill-small pill-purple"
                                    >
                                      {interest}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            <div className="mentor-match-arrow">
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </div>

                            <div className="mentor-match-person">
                              <div className="mentor-match-person-label">Why this person</div>
                              <div className="mentor-match-reasons" style={{ marginTop: 6 }}>
                                {candidate.matchReasons.map((reason) => (
                                  <div
                                    key={`${candidate.mentorId}-${reason}`}
                                    className="mentor-match-reason"
                                  >
                                    <span className="mentor-match-reason-dot" />
                                    {reason}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {!isApproved ? (
                            <div className="mentor-match-actions">
                              <button
                                type="button"
                                className="button small"
                                disabled={isPending}
                                onClick={() => handleApprove(group, candidate.mentorId)}
                                style={{ marginTop: 0 }}
                              >
                                Approve assignment
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
