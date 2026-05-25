"use client";

import { useState } from "react";
import { reviewJoinRequest } from "@/lib/chapter-join-actions";

type JoinRequest = {
  id: string;
  message: string | null;
  status: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    primaryRole: string;
    createdAt: Date;
  };
};

export function JoinRequestsPanel({ requests }: { requests: JoinRequest[] }) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReview(
    request: JoinRequest,
    decision: "APPROVED" | "REJECTED",
  ) {
    if (
      decision === "REJECTED" &&
      !window.confirm(
        `Reject ${request.user.name}'s request to join your chapter? They will not be added.`,
      )
    ) {
      return;
    }
    setProcessing(request.id);
    setError(null);
    try {
      await reviewJoinRequest(request.id, decision);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update the request. Please try again.",
      );
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="card">
      <h3>Pending Join Requests</h3>
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
        {requests.length} {requests.length === 1 ? "person wants" : "people want"} to join your chapter
      </p>

      {error && (
        <p
          role="alert"
          style={{
            margin: "12px 0 0",
            padding: "8px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: 13,
          }}
        >
          {error}
        </p>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {requests.map((request) => (
          <div
            key={request.id}
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <strong>{request.user.name}</strong>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                {request.user.email}
              </p>
              {request.message && (
                <p style={{ fontSize: 13, marginTop: 4, fontStyle: "italic" }}>
                  &ldquo;{request.message}&rdquo;
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                className="button small"
                disabled={processing === request.id}
                onClick={() => handleReview(request, "APPROVED")}
              >
                {processing === request.id ? "Working…" : "Approve"}
              </button>
              <button
                className="button small secondary"
                disabled={processing === request.id}
                onClick={() => handleReview(request, "REJECTED")}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
