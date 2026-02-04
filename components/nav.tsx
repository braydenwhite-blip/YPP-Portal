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
  { href: "/chapters", label: "Chapters" },
  { href: "/certificates", label: "My Certificates" },
  { href: "/profile", label: "My Profile" }
];

const applicantItems = [
  { href: "/positions", label: "Open Positions" },
  { href: "/applications", label: "My Applications" }
];

const mentorItems = [
  { href: "/mentorship/mentees", label: "My Mentees" }
];

const parentItems = [
  { href: "/parent", label: "Parent Portal" }
];

const adminItems = [
  { href: "/admin", label: "Admin Dashboard" },
  { href: "/admin/goals", label: "Manage Goals" },
  { href: "/admin/analytics", label: "Analytics" }
];

export default function Nav({ roles = [] }: { roles?: string[] }) {
  const pathname = usePathname();
  const isAdmin = roles.includes("ADMIN");
  const isMentor = roles.includes("MENTOR") || roles.includes("CHAPTER_LEAD");
  const isParent = roles.includes("PARENT");
  const isApplicant = roles.includes("STUDENT") || roles.includes("INSTRUCTOR") || roles.includes("STAFF");

  let items = [...baseItems];

  // Add applicant items for users who might apply to positions
  if (isApplicant || isAdmin) {
    const chaptersIndex = items.findIndex(i => i.href === "/chapters");
    items.splice(chaptersIndex + 1, 0, ...applicantItems);
  }

  if (isMentor || isAdmin) {
    // Insert mentor items after Mentorship
    const mentorshipIndex = items.findIndex(i => i.href === "/mentorship");
    items.splice(mentorshipIndex + 1, 0, ...mentorItems);
  }

  if (isParent) {
    items = [...parentItems, ...items];
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
