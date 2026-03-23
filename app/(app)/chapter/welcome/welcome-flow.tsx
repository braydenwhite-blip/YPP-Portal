"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboardingStep } from "@/lib/chapter-onboarding-actions";
import Link from "next/link";

type Step = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  isRequired: boolean;
  isCompleted: boolean;
  completedAt: Date | null;
  sortOrder: number;
};

const STEP_ICONS: Record<string, string> = {
  COMPLETE_PROFILE: "👤",
  MEET_THE_TEAM: "👋",
  JOIN_CHANNELS: "💬",
  INTRODUCE_SELF: "✍️",
  FIRST_PATHWAY: "🗺",
  INTRO_VIDEO: "🎥",
  SET_INTERESTS: "🎯",
  CUSTOM: "⭐",
};

const STEP_LINKS: Record<string, { href: string; label: string }> = {
  COMPLETE_PROFILE: { href: "/profile", label: "Go to Profile" },
  MEET_THE_TEAM: { href: "/chapter/members", label: "View Members" },
  JOIN_CHANNELS: { href: "/chapter/channels", label: "Browse Channels" },
  INTRODUCE_SELF: { href: "/chapter/channels", label: "Open Channels" },
  FIRST_PATHWAY: { href: "/pathways", label: "Browse Pathways" },
};

export function WelcomeFlow({
  steps,
  isComplete,
  currentStepIndex,
}: {
  steps: Step[];
  isComplete: boolean;
  currentStepIndex: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function handleComplete(stepId: string) {
    setCompletingId(stepId);
    try {
      await completeOnboardingStep(stepId);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      // Step might already be completed
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {steps.map((step, index) => {
        const isCurrent = index === currentStepIndex && !isComplete;
        const icon = STEP_ICONS[step.type] ?? "⭐";
        const link = STEP_LINKS[step.type];

        return (
          <div
            key={step.id}
            className="card"
            style={{
              border: isCurrent ? "2px solid var(--ypp-purple)" : "1px solid var(--border)",
              opacity: step.isCompleted ? 0.7 : 1,
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {/* Step indicator */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  background: step.isCompleted
                    ? "#dcfce7"
                    : isCurrent
                    ? "linear-gradient(135deg, var(--ypp-purple), var(--ypp-pink))"
                    : "var(--bg)",
                  color: step.isCompleted ? "#166534" : isCurrent ? "white" : "var(--muted)",
                }}
              >
                {step.isCompleted ? "✓" : icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    {step.title}
                  </h3>
                  {!step.isRequired && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--bg)",
                        color: "var(--muted)",
                      }}
                    >
                      Optional
                    </span>
                  )}
                  {step.isCompleted && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#dcfce7",
                        color: "#166534",
                      }}
                    >
                      Done
                    </span>
                  )}
                </div>
                {step.description && (
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted)", lineHeight: 1.4 }}>
                    {step.description}
                  </p>
                )}

                {/* Actions */}
                {!step.isCompleted && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className="button"
                      onClick={() => handleComplete(step.id)}
                      disabled={isPending || completingId === step.id}
                      style={{ fontSize: 13, padding: "6px 14px" }}
                    >
                      {completingId === step.id ? "..." : "Mark Complete"}
                    </button>
                    {link && (
                      <Link
                        href={link.href}
                        style={{
                          fontSize: 13,
                          color: "var(--ypp-purple)",
                          textDecoration: "none",
                        }}
                      >
                        {link.label} →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Completion CTA */}
      {isComplete && (
        <div
          className="card"
          style={{
            textAlign: "center",
            background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
            border: "1px solid #bbf7d0",
            padding: 32,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ margin: "0 0 8px", color: "#166534" }}>You&apos;re All Set!</h2>
          <p style={{ color: "#15803d", fontSize: 14, margin: "0 0 16px" }}>
            You&apos;ve completed your onboarding. Head to your chapter home to get started.
          </p>
          <Link href="/my-chapter" className="button">
            Go to Chapter Home →
          </Link>
        </div>
      )}

      {/* Skip option */}
      {!isComplete && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <Link
            href="/my-chapter"
            style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}
          >
            Skip for now — I&apos;ll finish later
          </Link>
        </div>
      )}
    </div>
  );
}
