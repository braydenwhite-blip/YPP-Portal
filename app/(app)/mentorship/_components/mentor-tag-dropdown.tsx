"use client";

import { useTransition } from "react";
import { setMentorTag } from "@/lib/mentorship-hub-actions";

const TAG_OPTIONS = [
  { value: "", label: "No flag" },
  { value: "FOLLOW_UP_NEEDED", label: "Follow-Up Needed" },
  { value: "OUTSTANDING_PERFORMANCE", label: "Outstanding" },
] as const;

type Props = {
  mentorshipId: string;
  currentTag: string | null;
};

export function MentorTagDropdown({ mentorshipId, currentTag }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    startTransition(async () => {
      await setMentorTag(mentorshipId, value === "" ? null : (value as any));
    });
  }

  return (
    <select
      value={currentTag ?? ""}
      onChange={handleChange}
      disabled={isPending}
      title="Flag this mentee"
      style={{
        fontSize: "0.7rem",
        padding: "2px 4px",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: 4,
        background: "var(--surface, #fff)",
        color: "var(--muted)",
        cursor: "pointer",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {TAG_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
