"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const baseItems = [
  { href: "/", label: "Overview" },
  { href: "/pathways", label: "Pathways" },
  { href: "/curriculum", label: "Courses" },
  { href: "/goals", label: "My Goals" },
  { href: "/instructor-training", label: "Instructor Training" },
  { href: "/mentorship", label: "Mentorship" },
  { href: "/events", label: "Events & Prep" },
  { href: "/chapters", label: "Chapters" }
];

const mentorItems = [
  { href: "/mentorship/mentees", label: "My Mentees" }
];

const adminItems = [
  { href: "/admin", label: "Admin Dashboard" },
  { href: "/admin/goals", label: "Manage Goals" }
];

export default function Nav({ roles = [] }: { roles?: string[] }) {
  const pathname = usePathname();
  const isAdmin = roles.includes("ADMIN");
  const isMentor = roles.includes("MENTOR") || roles.includes("CHAPTER_LEAD");

  let items = [...baseItems];

  if (isMentor || isAdmin) {
    // Insert mentor items after Mentorship
    const mentorshipIndex = items.findIndex(i => i.href === "/mentorship");
    items.splice(mentorshipIndex + 1, 0, ...mentorItems);
  }

  if (isAdmin) {
    items = [...items, ...adminItems];
  }

  return (
    <nav className="nav">
      {items.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "active" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
