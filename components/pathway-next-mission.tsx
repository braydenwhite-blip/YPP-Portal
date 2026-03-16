"use client";

interface Props {
  stepOrder: number;
  courseTitle: string;
  courseId: string;
  progressPercent: number;
  totalSteps: number;
  completedSteps: number;
  pathwayName: string;
}

function getMomentumCopy(progressPercent: number, completedSteps: number, totalSteps: number): string {
  if (completedSteps === 0) return "Your journey starts here — let's go!";
  if (progressPercent >= 75) return `Almost there! Just ${totalSteps - completedSteps} step${totalSteps - completedSteps === 1 ? "" : "s"} left.`;
  if (progressPercent >= 50) return "You're more than halfway — keep the momentum!";
  if (progressPercent >= 25) return "Great start! You're building something real.";
  return "You're on your way — every step counts!";
}

export default function PathwayNextMission({
  stepOrder,
  courseTitle,
  courseId,
  progressPercent,
  totalSteps,
  completedSteps,
  pathwayName,
}: Props) {
  const momentum = getMomentumCopy(progressPercent, completedSteps, totalSteps);
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference * (1 - progressPercent / 100);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--ypp-purple, #7c3aed) 0%, #5b21b6 100%)",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 24,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      {/* Progress ring */}
      <div style={{ flexShrink: 0, position: "relative", width: 68, height: 68 }}>
        <svg width="68" height="68" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
          <circle
            cx="34"
            cy="34"
            r="28"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          {progressPercent}%
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8, marginBottom: 4 }}>
          Your Next Mission — Step {stepOrder}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{courseTitle}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{momentum}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>+50 XP when you complete this step</div>
      </div>

      {/* CTA */}
      <a
        href={`/courses/${courseId}`}
        style={{
          background: "#fff",
          color: "var(--ypp-purple, #7c3aed)",
          fontWeight: 700,
          fontSize: 14,
          padding: "10px 20px",
          borderRadius: 8,
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Continue Step {stepOrder} →
      </a>
    </div>
  );
}
