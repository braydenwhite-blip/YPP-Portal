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

  async function handleReview(requestId: string, decision: "APPROVED" | "REJECTED") {
    setProcessing(requestId);
    try {
      await reviewJoinRequest(requestId, decision);
    } catch {
      // Error handled by server action
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
                onClick={() => handleReview(request.id, "APPROVED")}
              >
                Approve
              </button>
              <button
                className="button small secondary"
                disabled={processing === request.id}
                onClick={() => handleReview(request.id, "REJECTED")}
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
