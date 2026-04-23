"use client";

import { useTransition, useState } from "react";
import { resendChairDecisionEmail } from "@/lib/instructor-application-actions";

interface Props {
  applicationId: string;
  error: string;
  at: Date;
  canResend: boolean;
}

export default function NotificationFailureBanner({ applicationId, error, at, canResend }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleResend() {
    startTransition(async () => {
      const res = await resendChairDecisionEmail(applicationId);
      if (res.ok) {
        setResult({ ok: true, message: "Email resent successfully." });
      } else {
        setResult({ ok: false, message: res.error ?? "Email send failed." });
      }
    });
  }

  const formattedAt = new Date(at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      role="alert"
      className="notification-failure-banner"
      style={{
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        borderRadius: "8px",
        padding: "12px 16px",
        margin: "12px 0",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#991b1b", fontSize: "14px" }}>
          Notification was not delivered
        </p>
        <p style={{ margin: "0 0 2px", color: "#7f1d1d", fontSize: "13px" }}>
          {error}
        </p>
        <p style={{ margin: 0, color: "#b91c1c", fontSize: "12px" }}>
          Failed at {formattedAt}
        </p>
      </div>

      {canResend && !result?.ok && (
        <button
          type="button"
          onClick={handleResend}
          disabled={isPending}
          style={{
            flexShrink: 0,
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Sending..." : "Resend email"}
        </button>
      )}

      {result && (
        <p
          style={{
            flexShrink: 0,
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: result.ok ? "#166534" : "#991b1b",
          }}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
