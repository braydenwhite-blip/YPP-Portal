"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  pathwayName: string;
  pathwayId: string;
  xpEarned?: number;
}

function StepToast({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: "var(--ypp-purple, #7c3aed)",
        color: "#fff",
        borderRadius: 12,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 32px rgba(124,58,237,0.35)",
        animation: "slideUpIn 0.35s ease",
        maxWidth: 320,
      }}
    >
      <span style={{ fontSize: 24 }}>✓</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Step complete!</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>+50 XP earned — keep it up!</div>
      </div>
      <button
        onClick={onDismiss}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, marginLeft: 8, opacity: 0.7, padding: 0 }}
        aria-label="Dismiss"
      >
        ×
      </button>
      <style>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function PathwayCompleteOverlay({ pathwayName, pathwayId, xpEarned, onDismiss }: { pathwayName: string; pathwayId: string; xpEarned: number; onDismiss: () => void }) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "40px 48px",
          textAlign: "center",
          maxWidth: 440,
          width: "90%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Confetti dots via CSS */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                borderRadius: i % 3 === 0 ? "50%" : 2,
                background: ["#7c3aed","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899"][i % 6],
                left: `${(i * 37) % 100}%`,
                top: `${(i * 23) % 60}%`,
                animation: `confettiFall ${1.2 + (i % 4) * 0.3}s ease-in ${(i % 5) * 0.1}s both`,
              }}
            />
          ))}
        </div>

        <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--ypp-purple, #7c3aed)", marginBottom: 8 }}>
          Pathway Complete!
        </h2>
        <p style={{ fontSize: 16, color: "#374151", marginBottom: 4 }}>{pathwayName}</p>
        <div
          style={{
            display: "inline-block",
            background: "var(--ypp-purple, #7c3aed)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 18,
            padding: "6px 20px",
            borderRadius: 99,
            margin: "12px 0 24px",
          }}
        >
          +{xpEarned} XP Earned!
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href={`/pathways/${pathwayId}/certificate`}
            style={{
              background: "var(--ypp-purple, #7c3aed)",
              color: "#fff",
              fontWeight: 700,
              padding: "10px 24px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            View Certificate
          </a>
          <a
            href="/pathways"
            style={{
              background: "transparent",
              color: "var(--ypp-purple, #7c3aed)",
              fontWeight: 600,
              padding: "10px 24px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              border: "2px solid var(--ypp-purple, #7c3aed)",
            }}
          >
            Explore More
          </a>
        </div>
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16, cursor: "pointer" }} onClick={onDismiss}>
          Click anywhere to close
        </p>
        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes confettiFall {
            from { opacity: 1; transform: translateY(-20px) rotate(0deg); }
            to { opacity: 0; transform: translateY(80px) rotate(180deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function PathwayCelebration({ pathwayName, pathwayId, xpEarned = 500 }: Props) {
  const searchParams = useSearchParams();
  const celebrate = searchParams.get("celebrate");
  const [visible, setVisible] = useState(true);

  if (!celebrate || !visible) return null;

  const dismiss = () => setVisible(false);

  if (celebrate === "pathway") {
    return <PathwayCompleteOverlay pathwayName={pathwayName} pathwayId={pathwayId} xpEarned={xpEarned} onDismiss={dismiss} />;
  }
  if (celebrate === "step") {
    return <StepToast onDismiss={dismiss} />;
  }
  return null;
}
