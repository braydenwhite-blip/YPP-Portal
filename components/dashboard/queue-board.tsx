"use client";

import Link from "next/link";
import type { DashboardQueueCard } from "@/lib/dashboard/types";

function trackDashboardEvent(eventType: string, eventData: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({ eventType, eventData });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/dashboard", payload);
      return;
    }
    void fetch("/api/analytics/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Tracking should never block navigation.
  }
}

function statusColor(status: DashboardQueueCard["status"]) {
  if (status === "overdue") return "#b91c1c";
  if (status === "needs_action") return "#b45309";
  return "#166534";
}

function statusLabel(status: DashboardQueueCard["status"]) {
  if (status === "overdue") return "Overdue";
  if (status === "needs_action") return "Needs action";
  return "Healthy";
}

export default function QueueBoard({ queues }: { queues: DashboardQueueCard[] }) {
  if (queues.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Live Queues</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {queues.map((queue) => (
          <div
            key={queue.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              background: "var(--surface-alt)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{queue.title}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{queue.description}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 22 }}>{queue.count}</div>
                <div style={{ fontSize: 12, color: statusColor(queue.status) }}>{statusLabel(queue.status)}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <Link
                href={queue.href}
                className="link"
                onClick={() =>
                  trackDashboardEvent("dashboard_queue_open", {
                    queueId: queue.id,
                    href: queue.href,
                    count: queue.count,
                    status: queue.status,
                  })
                }
              >
                Open queue
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
