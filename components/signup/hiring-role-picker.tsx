"use client";

import { useRouter } from "next/navigation";

export type HiringRoleId = "instructor" | "cp" | "staff";

export const HIRING_ROLE_OPTIONS: Array<{
  id: HiringRoleId;
  title: string;
  blurb: string;
  href: string;
  continueLabel: string;
}> = [
  {
    id: "instructor",
    title: "Instructor",
    blurb: "Teach a course or workshop with students in your chapter.",
    href: "/signup/instructor",
    continueLabel: "Continue as Instructor",
  },
  {
    id: "cp",
    title: "Chapter President",
    blurb: "Lead a local YPP chapter — people, partners, and programs.",
    href: "/signup/chapter-president",
    continueLabel: "Continue as Chapter President",
  },
  {
    id: "staff",
    title: "Technology Manager",
    blurb: "Help build and support YPP’s portal tools and tech systems.",
    href: "/signup/technology-manager",
    continueLabel: "Continue as Technology Manager",
  },
];

export function hiringRoleHref(id: HiringRoleId): string {
  return HIRING_ROLE_OPTIONS.find((r) => r.id === id)?.href ?? "/signup/instructor";
}

export function hiringRoleContinueLabel(id: HiringRoleId): string {
  return (
    HIRING_ROLE_OPTIONS.find((r) => r.id === id)?.continueLabel ?? "Continue"
  );
}

/**
 * Role cards for open hiring paths.
 * Selected role is highlighted; switching roles can navigate or stay local.
 */
export function HiringRolePicker({
  value,
  current,
  onChange,
  navigateOnChange = false,
  className,
}: {
  value?: HiringRoleId;
  /** @deprecated Use `value` */
  current?: HiringRoleId;
  onChange?: (id: HiringRoleId) => void;
  navigateOnChange?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const selectedId = value ?? current ?? "instructor";

  return (
    <div className={className} style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--muted)",
          marginBottom: 10,
        }}
      >
        What role are you applying for?
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {HIRING_ROLE_OPTIONS.map((role) => {
          const selected = role.id === selectedId;
          return (
            <button
              key={role.id}
              type="button"
              aria-pressed={selected}
              aria-current={selected ? "true" : undefined}
              onClick={() => {
                if (role.id === selectedId) return;
                onChange?.(role.id);
                if (navigateOnChange) {
                  router.push(role.href);
                }
              }}
              style={{
                position: "relative",
                textAlign: "left",
                padding: "14px 14px 14px 14px",
                borderRadius: 12,
                border: selected ? "2px solid #6b21c8" : "1px solid var(--border)",
                background: selected ? "#f5f3ff" : "var(--background)",
                boxShadow: selected
                  ? "0 0 0 3px rgba(107, 33, 200, 0.12)"
                  : "none",
                cursor: selected ? "default" : "pointer",
                color: "inherit",
                transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: selected ? "#5b21b6" : "inherit",
                  }}
                >
                  {role.title}
                </span>
                {selected ? (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#6b21c8",
                      background: "#ede9fe",
                      borderRadius: 999,
                      padding: "3px 8px",
                    }}
                  >
                    Selected
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--muted)",
                  lineHeight: 1.45,
                }}
              >
                {role.blurb}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
        You can change roles anytime before you submit.
      </p>
    </div>
  );
}
