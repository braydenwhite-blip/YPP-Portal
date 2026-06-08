"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: { href: string; label: string }[] = [
  { href: "/my-mentor", label: "My Mentor" },
  { href: "/my-mentor/goals", label: "Goals" },
  { href: "/my-program/gr", label: "G&R Doc" },
  { href: "/my-mentor/resources", label: "Resources" },
  { href: "/my-mentor/progress", label: "Progress" },
  { href: "/my-mentor/awards", label: "Awards" },
  { href: "/my-program/achievement-journey", label: "Achievement Journey" },
  { href: "/my-mentor/reflection", label: "Reflection" },
  { href: "/my-mentor/schedule", label: "Schedule" },
  { href: "/my-program/certificate", label: "Certificate" },
  { href: "/my-mentor/help", label: "Get Help" },
];

/**
 * Shared sub-navigation for the mentee home so the supportive flows
 * (goals, resources, progress, reflection, schedule, help) feel like one
 * connected space rather than scattered pages.
 */
export function MyMentorSubnav() {
  const pathname = usePathname() ?? "/my-mentor";

  return (
    <nav
      aria-label="My Mentorship sections"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        margin: "0 0 20px",
        paddingBottom: 12,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {ITEMS.map((item) => {
        const active =
          item.href === "/my-mentor"
            ? pathname === "/my-mentor"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? "button small" : "button ghost small"}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default MyMentorSubnav;
