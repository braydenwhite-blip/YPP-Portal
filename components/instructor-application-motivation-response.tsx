interface InstructorApplicationMotivationResponseProps {
  motivation?: string | null;
  motivationVideoUrl?: string | null;
  label?: string;
}

export default function InstructorApplicationMotivationResponse({
  motivation,
  motivationVideoUrl,
  label = "TEACHING APPROACH VIDEO",
}: InstructorApplicationMotivationResponseProps) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px", fontWeight: 600 }}>
        {label}
      </p>

      {motivationVideoUrl ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <video
            controls
            preload="metadata"
            src={motivationVideoUrl}
            style={{
              width: "100%",
              borderRadius: 12,
              background: "#000",
              maxHeight: 320,
            }}
          />
          <a
            href={motivationVideoUrl}
            target="_blank"
            rel="noreferrer"
            className="link"
            style={{ fontSize: 13, width: "fit-content" }}
          >
            Open video in a new tab
          </a>
        </div>
      ) : motivation ? (
        <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{motivation}</p>
      ) : (
        <p style={{ fontSize: 14, margin: 0, color: "var(--muted)" }}>
          No teaching approach video was submitted.
        </p>
      )}

      {motivationVideoUrl && motivation ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px", fontWeight: 600 }}>
            LEGACY WRITTEN RESPONSE
          </p>
          <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap" }}>{motivation}</p>
        </div>
      ) : null}
    </div>
  );
}
