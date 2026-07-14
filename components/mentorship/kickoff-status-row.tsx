import { markKickoffComplete } from "@/lib/mentorship-actions";
import { CardV2, StatusBadge } from "@/components/ui-v2";

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
    <CardV2 as="section" padding="md" className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-progress-700">
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <strong className="text-[14px] text-ink">First meeting</strong>
          <StatusBadge tone={kickoffCompletedAt ? "success" : "warning"}>
            {kickoffCompletedAt ? "Done" : "Needed"}
          </StatusBadge>
        </div>
        {kickoffCompletedAt ? (
          <span className="text-[12.5px] text-ink-muted">Done {fmtDate(kickoffCompletedAt)}</span>
        ) : kickoffScheduledAt ? (
          <span className="text-[12.5px] text-ink-muted">Set for {fmtDate(kickoffScheduledAt)}</span>
        ) : (
          <span className="text-[12.5px] text-ink-muted">
            Not set yet. Have this meeting before monthly feedback starts.
          </span>
        )}
      </div>
      {!kickoffCompletedAt && canMarkComplete && (
        <form action={markKickoffComplete}>
          <input type="hidden" name="mentorshipId" value={mentorshipId} />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white"
          >
            Mark first meeting done
          </button>
        </form>
      )}
    </CardV2>
  );
}
