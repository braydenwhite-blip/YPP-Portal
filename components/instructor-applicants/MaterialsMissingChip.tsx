import type { ReactNode } from "react";

interface MaterialsMissingChipProps {
  materialsReadyAt: Date | string | null;
}

export default function MaterialsMissingChip({ materialsReadyAt }: MaterialsMissingChipProps): ReactNode {
  if (materialsReadyAt) return null;
  return (
    <span
      className="pill pill-attention pill-small"
      aria-label="Required materials not yet uploaded"
    >
      Materials missing
    </span>
  );
}
