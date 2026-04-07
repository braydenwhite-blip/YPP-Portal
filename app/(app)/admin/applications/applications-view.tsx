"use client";

import { useState } from "react";
import { ViewToggle, type KanbanView } from "@/components/kanban";
import ApplicationKanbanBoard, { type JobApplication } from "./kanban-board";
import Link from "next/link";
import {
  isHiringDecisionApproved,
  isHiringDecisionPending,
  isHiringDecisionReturned,
} from "@/lib/hiring-decision-utils";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function statusPillClass(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "pill-success";
    case "REJECTED":
    case "WITHDRAWN":
      return "pill-declined";
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEW_COMPLETED":
      return "pill-pathway";
    default:
      return "";
  }
}

export default function ApplicationsView({
  applications,
}: {
  applications: JobApplication[];
}) {
  const [view, setView] = useState<KanbanView>("kanban");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === "kanban" ? (
        <ApplicationKanbanBoard applications={applications} />
      ) : (
        <div className="card">
          <div className="section-title">All Applications</div>
          {applications.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No applications submitted yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Position</th>
                  <th>Chapter</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Next Interview</th>
                  <th>Decision</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => {
                  const nextSlot = application.interviewSlots.find(
                    (slot) => new Date(slot.scheduledAt) >= new Date()
                  );

                  return (
                    <tr key={application.id}>
                      <td>
                        <strong>{application.applicant.name}</strong>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {application.applicant.email}
                        </div>
                      </td>
                      <td>{application.position.title}</td>
                      <td>{application.position.chapter?.name || "Global"}</td>
                      <td>
                        <span className={`pill ${statusPillClass(application.status)}`}>
                          {formatStatus(application.status)}
                        </span>
                      </td>
                      <td>{new Date(application.submittedAt).toLocaleDateString()}</td>
                      <td>
                        {nextSlot
                          ? new Date(nextSlot.scheduledAt).toLocaleString()
                          : "Not scheduled"}
                      </td>
                      <td>
                        {application.decision ? (
                          isHiringDecisionApproved(application.decision) ? (
                            <span
                              className={`pill ${
                                application.decision.accepted ? "pill-success" : "pill-declined"
                              }`}
                            >
                              {application.decision.accepted ? "Accepted" : "Rejected"}
                            </span>
                          ) : isHiringDecisionPending(application.decision) ? (
                            <span className="pill pill-pathway">Chair Review</span>
                          ) : isHiringDecisionReturned(application.decision) ? (
                            <span className="pill pill-pending">Returned</span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: 13 }}>Pending</span>
                          )
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 13 }}>Pending</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/applications/${application.id}`}
                          className="button small"
                          style={{ textDecoration: "none" }}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
