"use client";

import { useState } from "react";

type FieldHelpProps = {
  title: string;
  guidance: string;
  example?: string;
};

export function FieldHelp({ title, guidance, example }: FieldHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Help: ${title}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1px solid var(--border)",
          background: open ? "var(--ypp-purple)" : "var(--surface-alt)",
          color: open ? "#fff" : "var(--muted)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ?
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            marginTop: 4,
            top: "100%",
            left: 0,
            width: 320,
            background: "var(--surface, #fff)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            padding: "12px 14px",
            fontSize: 13,
          }}
        >
          <strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
            {title}
          </strong>
          <p style={{ margin: "0 0 8px", color: "var(--foreground)", lineHeight: 1.5 }}>
            {guidance}
          </p>
          {example && (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--ypp-purple-50, #f3f0ff)",
                border: "1px solid var(--ypp-purple-200, #c4b5fd)",
                borderRadius: "var(--radius-sm, 4px)",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--foreground)",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 11, display: "block", marginBottom: 2 }}>
                Example:
              </span>
              {example}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

type FieldLabelProps = {
  label: string;
  required?: boolean;
  help?: FieldHelpProps;
};

export function FieldLabel({ label, required, help }: FieldLabelProps) {
  return (
    <label style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {label}
      {required && " *"}
      {help && <FieldHelp {...help} />}
    </label>
  );
}
