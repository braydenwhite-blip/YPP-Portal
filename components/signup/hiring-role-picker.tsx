"use client";

import { useRouter } from "next/navigation";

export type HiringRoleId = "instructor" | "cp" | "staff" | "interest";

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
    blurb: "Teach a course or workshop.",
    href: "/signup/instructor",
    continueLabel: "Continue as Instructor",
  },
  {
    id: "cp",
    title: "Chapter President",
    blurb: "Lead a local chapter.",
    href: "/signup/chapter-president",
    continueLabel: "Continue as Chapter President",
  },
  {
    id: "staff",
    title: "Technology Manager",
    blurb: "Build portal tools & tech.",
    href: "/signup/technology-manager",
    continueLabel: "Continue as Technology Manager",
  },
  {
    id: "interest",
    title: "General Interest",
    blurb: "Not sure yet — tell us how you’d like to get involved.",
    href: "/signup/interest",
    continueLabel: "Continue with General Interest",
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

export function goToHiringRole(id: HiringRoleId, router: { push: (href: string) => void }) {
  router.push(hiringRoleHref(id));
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
  layout = "grid",
  className,
}: {
  value?: HiringRoleId;
  /** @deprecated Use `value` */
  current?: HiringRoleId;
  onChange?: (id: HiringRoleId) => void;
  navigateOnChange?: boolean;
  /** `grid` = multi-column (wide forms). `stack` = one column (narrow cards). */
  layout?: "grid" | "stack";
  className?: string;
}) {
  const router = useRouter();
  const selectedId = value ?? current ?? "instructor";
  const isStack = layout === "stack";

  return (
    <div className={className} style={{ marginBottom: isStack ? 12 : 14 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        What role are you applying for?
      </div>
      <div
        className={isStack ? undefined : "ypp-apply-role-grid"}
        style={{
          display: "grid",
          gridTemplateColumns: isStack ? "1fr" : "repeat(2, minmax(0, 1fr))",
          gap: isStack ? 8 : 6,
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
                  goToHiringRole(role.id, router);
                }
              }}
              style={{
                position: "relative",
                textAlign: "left",
                padding: isStack ? "10px 12px" : "8px 10px",
                borderRadius: 8,
                border: selected ? "1.5px solid #6b21c8" : "1px solid var(--border)",
                background: selected ? "#f5f3ff" : "var(--background)",
                boxShadow: selected ? "0 0 0 2px rgba(107, 33, 200, 0.1)" : "none",
                cursor: selected ? "default" : "pointer",
                color: "inherit",
                transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
                minWidth: 0,
                display: isStack ? "flex" : undefined,
                alignItems: isStack ? "center" : undefined,
                justifyContent: isStack ? "space-between" : undefined,
                gap: isStack ? 10 : undefined,
              }}
            >
              <span style={{ minWidth: 0, flex: isStack ? 1 : undefined }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 4,
                    marginBottom: isStack ? 2 : 2,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: isStack ? 13.5 : 12.5,
                      color: selected ? "#5b21b6" : "inherit",
                      lineHeight: 1.25,
                    }}
                  >
                    {role.title}
                  </span>
                  {!isStack && selected ? (
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        textTransform: "uppercase",
                        color: "#6b21c8",
                        background: "#ede9fe",
                        borderRadius: 999,
                        padding: "1px 5px",
                      }}
                    >
                      Selected
                    </span>
                  ) : null}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: isStack ? 12 : 11,
                    color: "var(--muted)",
                    lineHeight: 1.3,
                  }}
                >
                  {role.blurb}
                </span>
              </span>
              {isStack ? (
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: selected ? "5px solid #6b21c8" : "1.5px solid #c4b5fd",
                    background: selected ? "#fff" : "transparent",
                    boxSizing: "border-box",
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
