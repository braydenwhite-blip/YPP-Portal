"use client";

import { useEffect, useCallback, useState } from "react";

export default function KanbanDetailPanel({
  title,
  subtitle,
  statusBadge,
  onClose,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  statusBadge?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="slideout-backdrop" onClick={onClose} />
      <div className="slideout-panel">
        <div className="slideout-header">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
            {subtitle && (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {subtitle}
              </span>
            )}
            {statusBadge && (
              <div style={{ marginTop: 6 }}>{statusBadge}</div>
            )}
          </div>
          <button className="slideout-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="slideout-body">{children}</div>
      </div>
    </>
  );
}

/** Toast message strip for detail panels */
export function PanelToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      style={{
        padding: "8px 24px",
        background: "#f0fdf4",
        color: "#16a34a",
        fontSize: 13,
        fontWeight: 500,
        borderBottom: "1px solid #bbf7d0",
      }}
    >
      {message}
    </div>
  );
}

/** Hook for toast messages with auto-dismiss */
export function useToast(timeout = 3000) {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      setTimeout(() => setMessage(null), timeout);
    },
    [timeout]
  );
  return { message, show };
}
