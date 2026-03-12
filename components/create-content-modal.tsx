"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type ContentOption = {
  title: string;
  description: string;
  href: string;
  icon: string;
  color: string;
};

const OPTIONS: ContentOption[] = [
  {
    title: "Class",
    description: "Build a curriculum and create class offerings for students.",
    href: "/instructor/curriculum-builder",
    icon: "📚",
    color: "#7c3aed",
  },
  {
    title: "Passion Lab",
    description: "Design a hands-on passion project lab with sessions and showcases.",
    href: "/instructor/passion-lab-builder",
    icon: "🔬",
    color: "#2563eb",
  },
  {
    title: "Competition",
    description: "Draft a passion-area competition (admin will publish).",
    href: "/instructor/competition-builder",
    icon: "🏆",
    color: "#d97706",
  },
  {
    title: "Sequence",
    description: "Chain classes and labs into an ordered learning sequence.",
    href: "/instructor/sequence-builder",
    icon: "🗺️",
    color: "#16a34a",
  },
];

type CreateContentModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateContentModal({ open, onClose }: CreateContentModalProps) {
  const router = useRouter();

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.45)",
          zIndex: 9998,
        }}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create content"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          width: "min(92vw, 680px)",
          padding: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>What do you want to create?</h2>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "4px 0 0" }}>
              Choose a content type to get started.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "var(--muted)",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {OPTIONS.map((option) => (
            <button
              key={option.href}
              type="button"
              onClick={() => {
                onClose();
                router.push(option.href);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                padding: 20,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = option.color;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 2px ${option.color}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "var(--radius-md)",
                  background: `${option.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                {option.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>
                  {option.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                  {option.description}
                </div>
              </div>
              <div
                style={{
                  marginTop: "auto",
                  fontSize: 12,
                  fontWeight: 600,
                  color: option.color,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Get started →
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
