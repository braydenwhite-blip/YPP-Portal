"use client";

import type { CSSProperties, ReactNode } from "react";

import { MeetingIcon } from "./meeting-icons";

/**
 * Shared form primitives for the Meetings Tracker drawers (New Meeting, Add /
 * Convert Follow-Up). Ported from the design's `forms.jsx` Drawer shell + Field
 * helpers so both flows look identical.
 */

export const fieldStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  font: "inherit",
  fontSize: 14,
  color: "var(--ypp-ink)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "9px 11px",
};

export function Label({ children, req }: { children: ReactNode; req?: boolean }) {
  return (
    <label
      style={{
        fontSize: 11.5,
        fontWeight: 800,
        letterSpacing: ".02em",
        textTransform: "uppercase",
        color: "var(--muted)",
        display: "flex",
        gap: 3,
        marginBottom: 7,
      }}
    >
      {children}
      {req && <span style={{ color: "var(--danger-fg)" }}>*</span>}
    </label>
  );
}

export function Field({
  label,
  req,
  children,
  full,
}: {
  label: string;
  req?: boolean;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gridColumn: full ? "1 / -1" : "auto" }}>
      <Label req={req}>{label}</Label>
      {children}
    </div>
  );
}

export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 560,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(28,20,55,.38)", backdropFilter: "blur(2px)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: width,
          background: "var(--bg, #f6f5fa)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-18px 0 50px -16px rgba(28,20,60,.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "var(--ypp-ink)", letterSpacing: "-.01em" }}>
              {title}
            </h2>
            {subtitle && <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--muted)" }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
            }}
          >
            <MeetingIcon name="x" size={17} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 9,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 40,
        height: 23,
        borderRadius: 999,
        flex: "0 0 auto",
        background: on ? "var(--ypp-purple-600)" : "var(--chip-border)",
        position: "relative",
        transition: "background .16s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2.5,
          left: on ? 19 : 2.5,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          transition: "left .16s",
        }}
      />
    </span>
  );
}
