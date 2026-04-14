import { markKickoffComplete } from "@/lib/mentorship-actions";

type Props = {
  mentorshipId: string;
  kickoffScheduledAt: Date | null;
  kickoffCompletedAt: Date | null;
  canMarkComplete: boolean;
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function KickoffStatusRow({
  mentorshipId,
  kickoffScheduledAt,
  kickoffCompletedAt,
  canMarkComplete,
}: Props) {
  return (
    <div
      className="card"
      style={{
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
        <strong style={{ fontSize: "0.9rem" }}>Kickoff</strong>
        {kickoffCompletedAt ? (
          <span className="muted">Completed {fmtDate(kickoffCompletedAt)}</span>
        ) : kickoffScheduledAt ? (
          <span className="muted">Scheduled for {fmtDate(kickoffScheduledAt)}</span>
        ) : (
          <span className="muted">Not yet scheduled</span>
        )}
      </div>
      {!kickoffCompletedAt && canMarkComplete && (
        <form action={markKickoffComplete}>
          <input type="hidden" name="mentorshipId" value={mentorshipId} />
          <button type="submit" className="button primary small">
            Mark kickoff complete
          </button>
        </form>
      )}
    </div>
  );
}
