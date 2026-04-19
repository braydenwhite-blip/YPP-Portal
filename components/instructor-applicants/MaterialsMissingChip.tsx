import type { ReactNode } from "react";

interface MaterialsMissingChipProps {
  materialsReadyAt: Date | string | null;
}

export default function MaterialsMissingChip({ materialsReadyAt }: MaterialsMissingChipProps): ReactNode {
  if (materialsReadyAt) return null;
  return (
    <span className="pill pill-attention pill-small">Materials missing</span>
  );
}
