"use client";

export default function WorldError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        color: "white",
        zIndex: 50,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ fontSize: 48 }}>{"\u{1F30A}"}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        Your world encountered a storm
      </div>
      <div style={{ fontSize: 14, opacity: 0.6, maxWidth: 320, textAlign: "center" }}>
        Something went wrong loading the Passion World. This may be a temporary issue.
      </div>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: "10px 24px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(255,255,255,0.1)",
          color: "white",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Try Again
      </button>
    </div>
  );
}
