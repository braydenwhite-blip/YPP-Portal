import type { ReactNode } from "react";
import { MENTION_TOKEN_REGEX } from "@/lib/mentions";

export function renderTextWithMentions(body: string): ReactNode[] {
  const parts = body.split(/(@[a-z0-9._-]+)/gi);
  return parts.map((part, index) =>
    MENTION_TOKEN_REGEX.test(part) ? (
      <span key={index} className="font-semibold text-brand-700">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}
