"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmProvisionalHire } from "@/lib/people-strategy/provisional-actions";

/** Serializable mirror of ProvisionalStatus (dates as ISO strings). */
export interface ProvisionalStatusView {
  isProvisional: boolean;
  confirmed: boolean;
  startDate: string | null;
  confirmedAt: string | null;
  monthThreeDate: string | null;
  daysRemaining: number | null;
  atMonthThree: boolean;
  percentElapsed: number;
}

const CONFIRMATION_CRITERIA = [
  "Green across core goals",
  "Positive feedback",
  "Mentor endorsement",
  "Senior leadership or Board approval",
];

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—";
}

function Badge({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 12px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function CriteriaReminder() {
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Confirmation criteria
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, color: "#44403c", fontSize: 13, lineHeight: 1.7 }}>
        {CONFIRMATION_CRITERIA.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

export function ProvisionalStatusCard({
  userId,
  status,
  canConfirm,
  quarterlyFormAvailable,
}: {
  userId: string;
  status: ProvisionalStatusView;
  canConfirm: boolean;
  quarterlyFormAvailable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await confirmProvisionalHire(userId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to confirm");
      }
    });
  }

  // ── Confirmed ──
  if (status.confirmed) {
    return (
      <div>
        <Badge color="#166534" bg="#dcfce7" label="✓ Confirmed" />
        <p style={{ margin: "10px 0 0", color: "#44403c", fontSize: 14 }}>
          Provisional period complete — hire confirmed on{" "}
          <strong>{formatDate(status.confirmedAt)}</strong>.
        </p>
      </div>
    );
  }

  // ── Not provisional (no clock running) ──
  if (!status.isProvisional) {
    return (
      <p className="instructor-profile-muted">
        Not in a provisional period. The 3-month confirmation clock starts when
        this person is hired as an instructor.
      </p>
    );
  }

  // ── Provisional: countdown + (at Month 3) confirmation decision ──
  const days = status.daysRemaining ?? 0;
  const atMonthThree = status.atMonthThree;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Badge color="#92400e" bg="#fef3c7" label="Provisional" />
        {atMonthThree ? (
          <Badge color="#991b1b" bg="#fee2e2" label="Month-3 review due" />
        ) : (
          <span style={{ fontSize: 13, color: "#57534e", fontWeight: 600 }}>
            {days} day{days === 1 ? "" : "s"} until Month-3 review
          </span>
        )}
      </div>

      <p style={{ margin: "10px 0 6px", fontSize: 13, color: "#57534e" }}>
        Started <strong>{formatDate(status.startDate)}</strong> · Month-3 review
        due <strong>{formatDate(status.monthThreeDate)}</strong>
        {atMonthThree && days < 0 ? ` (${Math.abs(days)} days overdue)` : ""}
      </p>

      {/* Progress bar */}
      <div
        aria-hidden
        style={{
          height: 8,
          borderRadius: 999,
          background: "#f1f5f9",
          overflow: "hidden",
          margin: "6px 0 4px",
        }}
      >
        <div
          style={{
            width: `${status.percentElapsed}%`,
            height: "100%",
            background: atMonthThree ? "#dc2626" : "#d97706",
          }}
        />
      </div>

      <CriteriaReminder />

      {atMonthThree && (
        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#9a3412" }}>
            Month-3 confirmation decision
          </p>
          <p style={{ margin: "4px 0 12px", fontSize: 13, color: "#7c2d12" }}>
            Record the decision in the{" "}
            {quarterlyFormAvailable ? (
              <a href="#quarterly-review" style={{ fontWeight: 600, color: "#9a3412" }}>
                Quarterly Review
              </a>
            ) : (
              "Quarterly Review"
            )}{" "}
            below, then confirm the hire to clear provisional status.
          </p>
          {canConfirm ? (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              style={{
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: isPending ? "default" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? "Confirming…" : "Confirm hire"}
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "#7c2d12" }}>
              Senior leadership / Board confirmation required.
            </p>
          )}
          {error && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c" }}>{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
