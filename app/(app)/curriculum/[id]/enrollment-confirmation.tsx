"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const DEFAULT_DONATION_URL =
  process.env.NEXT_PUBLIC_DONATION_URL || "https://www.youthpassionproject.org/donate";

const SUGGESTED_AMOUNTS = [18, 36, 72] as const;

export type EnrollmentConfirmationProps = {
  open: boolean;
  onClose: () => void;
  status: "ENROLLED" | "WAITLISTED";
  alreadyEnrolled: boolean;
  classTitle: string;
  deliveryMode: string;
  meetingTime: string;
  meetingDays: string[];
  startDate: string | null;
  hasZoomLink: boolean;
  hasLocation: boolean;
  waitlistPosition: number | null;
  donationUrl?: string;
};

export function EnrollmentConfirmation({
  open,
  onClose,
  status,
  alreadyEnrolled,
  classTitle,
  deliveryMode,
  meetingTime,
  meetingDays,
  startDate,
  hasZoomLink,
  hasLocation,
  waitlistPosition,
  donationUrl = DEFAULT_DONATION_URL,
}: EnrollmentConfirmationProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | "other" | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isWaitlist = status === "WAITLISTED";
  const heading = alreadyEnrolled
    ? isWaitlist
      ? "You're already on the waitlist"
      : "You're already signed up"
    : isWaitlist
      ? "You're on the waitlist"
      : "You're signed up!";

  const accessLine = isWaitlist
    ? "We'll notify you right here the moment a seat opens up. Until then, you can browse other open classes."
    : hasZoomLink
      ? "Your Zoom link and class materials live in My Classes, along with session reminders before each class."
      : hasLocation
        ? "Your class location and any prep details live in My Classes, along with session reminders before each class."
        : "Access details (Zoom link, materials, or location) will appear in My Classes before the first session.";

  const donateHref = (() => {
    if (donationUrl === "#" || !donationUrl) return "#";
    if (selectedAmount && selectedAmount !== "other") {
      const sep = donationUrl.includes("?") ? "&" : "?";
      return `${donationUrl}${sep}amount=${selectedAmount}`;
    }
    return donationUrl;
  })();

  return (
    <div
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enroll-confirm-title"
        tabIndex={-1}
        style={{
          background: "var(--surface, #fff)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.25)",
          outline: "none",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: "var(--gray-100, #f3f4f6)",
            color: "var(--text-secondary)",
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: isWaitlist ? "#fffbeb" : "#f0fdf4",
            color: isWaitlist ? "#b45309" : "#16a34a",
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 12,
          }}
          aria-hidden
        >
          {isWaitlist ? "•" : "✓"}
        </div>

        <h2 id="enroll-confirm-title" style={{ margin: "0 0 4px", fontSize: 22 }}>
          {heading}
        </h2>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
          {classTitle}
        </p>

        <div
          style={{
            marginTop: 16,
            padding: 14,
            background: "var(--gray-50, #f8fafc)",
            borderRadius: 12,
            fontSize: 13,
            color: "var(--text-secondary)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div>
            <strong style={{ color: "var(--text)" }}>Format:</strong> {deliveryMode}
          </div>
          {meetingDays.length > 0 && (
            <div>
              <strong style={{ color: "var(--text)" }}>Schedule:</strong>{" "}
              {meetingDays.join(", ")} · {meetingTime}
            </div>
          )}
          {startDate && (
            <div>
              <strong style={{ color: "var(--text)" }}>Starts:</strong> {startDate}
            </div>
          )}
          {isWaitlist && waitlistPosition !== null && (
            <div>
              <strong style={{ color: "var(--text)" }}>Waitlist position:</strong> #
              {waitlistPosition}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>What happens next</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
            {accessLine}
          </p>
          <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
            Your spot is saved — everything you need is in <strong>My Classes</strong>.
          </p>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 16,
            border: "1px dashed var(--ypp-purple-200, #d8b4fe)",
            borderRadius: 12,
            background: "var(--ypp-purple-50, #faf5ff)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--ypp-purple, #7c3aed)",
              letterSpacing: "0.05em",
            }}
          >
            Optional
          </div>
          <h3 style={{ margin: "4px 0 6px", fontSize: 16 }}>
            Support free student-led classes
          </h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
            YPP classes are free for students. Optional donations help us keep programs
            accessible, support student instructors, and offer more classes to more
            families. Your signup is already complete — donating is never required.
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {SUGGESTED_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setSelectedAmount(amount)}
                aria-pressed={selectedAmount === amount}
                className="button secondary"
                style={{
                  fontSize: 13,
                  padding: "6px 14px",
                  ...(selectedAmount === amount
                    ? {
                        background: "var(--ypp-purple, #7c3aed)",
                        color: "white",
                        borderColor: "var(--ypp-purple, #7c3aed)",
                      }
                    : {}),
                }}
              >
                ${amount}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedAmount("other")}
              aria-pressed={selectedAmount === "other"}
              className="button secondary"
              style={{
                fontSize: 13,
                padding: "6px 14px",
                ...(selectedAmount === "other"
                  ? {
                      background: "var(--ypp-purple, #7c3aed)",
                      color: "white",
                      borderColor: "var(--ypp-purple, #7c3aed)",
                    }
                  : {}),
              }}
            >
              Other
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <a
              href={donateHref}
              target="_blank"
              rel="noopener noreferrer"
              className="button"
              style={{ fontSize: 13 }}
              onClick={(event) => {
                if (donateHref === "#") {
                  event.preventDefault();
                  alert(
                    "Donations are coming soon. Thanks for the interest — your signup is confirmed.",
                  );
                }
              }}
            >
              {selectedAmount && selectedAmount !== "other"
                ? `Donate $${selectedAmount}`
                : "Donate after signup"}
            </a>
            <button type="button" onClick={onClose} className="button secondary" style={{ fontSize: 13 }}>
              Continue without donating
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <Link href="/my-classes" className="button primary" style={{ flex: 1, minWidth: 160, textAlign: "center" }}>
            Go to My Classes
          </Link>
          <Link
            href="/curriculum"
            onClick={onClose}
            className="button secondary"
            style={{ flex: 1, minWidth: 160, textAlign: "center" }}
          >
            Browse more classes
          </Link>
        </div>
      </div>
    </div>
  );
}
