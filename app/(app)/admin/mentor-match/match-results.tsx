"use client";

import { useState, useTransition } from "react";
import {
  computeMentorMatches,
  approveMentorMatch,
  type MentorMatchSuggestion,
} from "@/lib/mentor-match-actions";

interface ActiveMentorship {
  id: string;
  mentorName: string;
  mentorEmail: string;
  menteeName: string;
  menteeEmail: string;
  type: string;
  startDate: string;
}

export default function MentorMatchUI({
  activeMentorships,
  mentorCount,
  instructorCount,
  studentCount,
}: {
  activeMentorships: ActiveMentorship[];
  mentorCount: number;
  instructorCount: number;
  studentCount: number;
}) {
  const [matchType, setMatchType] = useState<"INSTRUCTOR" | "STUDENT">("INSTRUCTOR");
  const [suggestions, setSuggestions] = useState<MentorMatchSuggestion[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [approvedPairs, setApprovedPairs] = useState<Set<string>>(new Set());

  function runMatch() {
    startTransition(async () => {
      const results = await computeMentorMatches(matchType);
      setSuggestions(results);
      setHasRun(true);
      setApprovedPairs(new Set());
    });
  }

  function handleApprove(suggestion: MentorMatchSuggestion) {
    const formData = new FormData();
    formData.set("mentorId", suggestion.mentorId);
    formData.set("menteeId", suggestion.menteeId);
    formData.set("type", suggestion.type);

    startTransition(async () => {
      await approveMentorMatch(formData);
      setApprovedPairs((prev) => {
        const next = new Set(prev);
        next.add(`${suggestion.mentorId}-${suggestion.menteeId}`);
        return next;
      });
    });
  }

  function getScoreColor(score: number) {
    if (score >= 70) return "pill-success";
    if (score >= 40) return "";
    return "pill-pending";
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{mentorCount}</div>
          <div className="kpi-label">Mentors</div>
        </div>
        <div className="card">
          <div className="kpi">{instructorCount}</div>
          <div className="kpi-label">Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{studentCount}</div>
          <div className="kpi-label">Students</div>
        </div>
        <div className="card">
          <div className="kpi">{activeMentorships.length}</div>
          <div className="kpi-label">Active Pairings</div>
        </div>
      </div>

      {/* Match controls */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Run Matching Algorithm</h3>
        <p style={{ marginBottom: 16 }}>
          The algorithm scores potential pairs based on shared interests, chapter proximity,
          mentor workload, and profile completeness. Unmatched mentees (those without an active
          mentorship of the selected type) will be matched to the best available mentor.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="mentor-match-type-toggle">
            <button
              className={`mentor-match-type-btn ${matchType === "INSTRUCTOR" ? "active" : ""}`}
              onClick={() => { setMatchType("INSTRUCTOR"); setHasRun(false); }}
            >
              Instructor Mentees
            </button>
            <button
              className={`mentor-match-type-btn ${matchType === "STUDENT" ? "active" : ""}`}
              onClick={() => { setMatchType("STUDENT"); setHasRun(false); }}
            >
              Student Mentees
            </button>
          </div>
          <button
            className="button small"
            onClick={runMatch}
            disabled={isPending}
            style={{ marginTop: 0 }}
          >
            {isPending ? "Computing..." : "Find Best Matches"}
          </button>
        </div>
      </div>

      {/* Match results */}
      {hasRun && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">
            Match Results ({suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""})
          </div>
          {suggestions.length === 0 ? (
            <div className="card">
              <p className="empty">
                No unmatched {matchType === "INSTRUCTOR" ? "instructors" : "students"} found,
                or no mentors available.
              </p>
            </div>
          ) : (
            <div className="mentor-match-results">
              {suggestions.map((s) => {
                const pairKey = `${s.mentorId}-${s.menteeId}`;
                const isApproved = approvedPairs.has(pairKey);

                return (
                  <div
                    key={pairKey}
                    className={`mentor-match-card ${isApproved ? "approved" : ""}`}
                  >
                    <div className="mentor-match-card-header">
                      <span className={`pill ${getScoreColor(s.matchScore)}`}>
                        Score: {s.matchScore}
                      </span>
                      {isApproved && (
                        <span className="pill pill-success">Approved</span>
                      )}
                    </div>

                    <div className="mentor-match-pair">
                      <div className="mentor-match-person">
                        <div className="mentor-match-person-label">Mentor</div>
                        <div className="mentor-match-person-name">{s.mentorName}</div>
                        <div className="mentor-match-person-email">{s.mentorEmail}</div>
                        {s.mentorChapter && (
                          <div className="mentor-match-person-detail">Chapter: {s.mentorChapter}</div>
                        )}
                        <div className="mentor-match-person-detail">
                          {s.mentorCurrentMentees} current mentee{s.mentorCurrentMentees !== 1 ? "s" : ""}
                        </div>
                        {s.mentorInterests.length > 0 && (
                          <div className="mentor-match-interests">
                            {s.mentorInterests.slice(0, 4).map((i) => (
                              <span key={i} className="pill pill-small pill-purple">{i}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mentor-match-arrow">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>

                      <div className="mentor-match-person">
                        <div className="mentor-match-person-label">
                          {s.type === "INSTRUCTOR" ? "Instructor" : "Student"}
                        </div>
                        <div className="mentor-match-person-name">{s.menteeName}</div>
                        <div className="mentor-match-person-email">{s.menteeEmail}</div>
                        {s.menteeChapter && (
                          <div className="mentor-match-person-detail">Chapter: {s.menteeChapter}</div>
                        )}
                        {s.menteeInterests.length > 0 && (
                          <div className="mentor-match-interests">
                            {s.menteeInterests.slice(0, 4).map((i) => (
                              <span key={i} className="pill pill-small pill-purple">{i}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mentor-match-reasons">
                      {s.matchReasons.map((r, idx) => (
                        <div key={idx} className="mentor-match-reason">
                          <span className="mentor-match-reason-dot" />
                          {r}
                        </div>
                      ))}
                    </div>

                    {!isApproved && (
                      <div className="mentor-match-actions">
                        <button
                          className="button small"
                          onClick={() => handleApprove(s)}
                          disabled={isPending}
                          style={{ marginTop: 0 }}
                        >
                          Approve & Create Pairing
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Active Mentorships */}
      <div>
        <div className="section-title">Active Mentorships ({activeMentorships.length})</div>
        <div className="card">
          {activeMentorships.length === 0 ? (
            <p className="empty">No active mentorships.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Mentee</th>
                  <th>Type</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {activeMentorships.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.mentorName}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.mentorEmail}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.menteeName}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.menteeEmail}</div>
                    </td>
                    <td>
                      <span className="pill pill-small pill-info">{m.type}</span>
                    </td>
                    <td>{new Date(m.startDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
