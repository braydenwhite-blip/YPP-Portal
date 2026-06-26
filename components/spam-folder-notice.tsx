import type { CSSProperties } from "react";

/**
 * Reusable "check your spam folder" warning for any surface where we email the
 * user (signup confirmations, magic links, password resets, setup links). Our
 * messages have been landing in spam/junk for some people, so we surface this
 * prominently wherever someone is about to wait on an email from us.
 *
 * Styled with inline styles + CSS variables to match the public auth surfaces
 * (login / signup), which don't use the Tailwind ui-v2 primitives.
 */
export default function SpamFolderNotice({
  style,
  compact = false,
}: {
  /** Extra style overrides (e.g. margins) merged onto the container. */
  style?: CSSProperties;
  /** Drop the lead-in headline for tight spots like under a form field. */
  compact?: boolean;
}) {
  return (
    <div
      role="note"
      style={{
        padding: compact ? "10px 14px" : "12px 16px",
        borderRadius: 10,
        background: "#fef3c7",
        border: "1px solid #fde68a",
        fontSize: 13,
        lineHeight: 1.55,
        color: "#78350f",
        ...style,
      }}
    >
      <span aria-hidden style={{ marginRight: 6 }}>
        📩
      </span>
      {!compact && (
        <strong>Don&apos;t see our email? Check your spam or junk folder. </strong>
      )}
      Emails from the YPP Pathways Portal sometimes land in spam. Please check
      that folder and mark our messages as &quot;Not spam&quot; (or add us to your
      contacts) so you don&apos;t miss important updates.
    </div>
  );
}
