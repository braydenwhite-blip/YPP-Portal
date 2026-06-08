"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { reviewMentorshipApplication } from "@/lib/mentorship-2/application-actions";
import {
  APPLICATION_STATUS_TRANSITIONS,
  MENTORSHIP_APPLICATION_STATUS_LABELS,
  type MentorshipApplicationStatus,
} from "@/lib/mentorship-2/constants";

export type ApplicationRow = {
  id: string;
  status: MentorshipApplicationStatus;
  applicantName: string | null;
  applicantEmail: string;
  goals: string | null;
  interests: string[];
  preferredExpertise: string[];
  availability: string | null;
  motivation: string | null;
  createdAt: string;
};

export function ApplicationsQueue({ applications }: { applications: ApplicationRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  function review(
    id: string,
    status: MentorshipApplicationStatus
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await reviewMentorshipApplication({
          applicationId: id,
          status,
          reviewNotes: notesById[id]?.trim() || undefined,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update application.");
      }
    });
  }

  if (applications.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 14 }}>
        No mentorship applications in this view.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && (
        <p role="alert" style={{ color: "var(--color-danger, #c0392b)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      {applications.map((app) => {
        const nextStates = APPLICATION_STATUS_TRANSITIONS[app.status];
        return (
          <section key={app.id} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>{app.applicantName ?? app.applicantEmail}</strong>
                <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
                  {app.applicantEmail} · applied {new Date(app.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="pill">
                {MENTORSHIP_APPLICATION_STATUS_LABELS[app.status]}
              </span>
            </div>

            {app.goals && (
              <p style={{ margin: 0, fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>Goals:</span> {app.goals}
              </p>
            )}
            {app.interests.length > 0 && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Interests: {app.interests.join(", ")}
              </p>
            )}
            {app.preferredExpertise.length > 0 && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Seeking expertise: {app.preferredExpertise.join(", ")}
              </p>
            )}
            {app.availability && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Availability: {app.availability}
              </p>
            )}

            {nextStates.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={notesById[app.id] ?? ""}
                  onChange={(e) =>
                    setNotesById((prev) => ({ ...prev, [app.id]: e.target.value }))
                  }
                  placeholder="Review notes (optional)"
                  maxLength={2000}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {nextStates.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={status === "MATCHED" ? "button small" : "button secondary small"}
                      disabled={isPending}
                      onClick={() => review(app.id, status)}
                    >
                      {MENTORSHIP_APPLICATION_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
