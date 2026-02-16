"use client";

interface StepperStep {
  label: string;
  complete: boolean;
  active: boolean;
  detail: string;
}

interface ApplicationProgressStepperProps {
  steps: StepperStep[];
}

export default function ApplicationProgressStepper({ steps }: ApplicationProgressStepperProps) {
  return (
    <div style={{ position: "relative" }}>
      {/* Vertical line connector */}
      <div
        style={{
          position: "absolute",
          left: 15,
          top: 16,
          bottom: 16,
          width: 2,
          background: "var(--border)",
          zIndex: 0,
        }}
      />

      <div style={{ display: "grid", gap: 0 }}>
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;

          return (
            <div
              key={step.label}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "10px 0",
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* Step indicator */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                  background: step.complete
                    ? "#16a34a"
                    : step.active
                      ? "#7c3aed"
                      : "var(--surface)",
                  color: step.complete || step.active ? "#fff" : "var(--muted)",
                  border: step.complete || step.active
                    ? "none"
                    : "2px solid var(--border)",
                  transition: "all 0.2s ease",
                }}
              >
                {step.complete ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Step content */}
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 600,
                    fontSize: 14,
                    color: step.complete
                      ? "#166534"
                      : step.active
                        ? "#7c3aed"
                        : "var(--text)",
                  }}
                >
                  {step.label}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
