"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const baseItems = [
  { href: "/", label: "Overview" },
  { href: "/pathways", label: "Pathways" },
  { href: "/curriculum", label: "Curriculum" },
  { href: "/instructor-training", label: "Instructor Training" },
  { href: "/mentorship", label: "Mentorship" },
  { href: "/events", label: "Events & Prep" },
  { href: "/chapters", label: "Chapters" }
];

export default function Nav({ roles = [] }: { roles?: string[] }) {
  const pathname = usePathname();
  const items = roles.includes("ADMIN")
    ? [...baseItems, { href: "/admin", label: "Admin" }]
    : baseItems;

  return (
    <nav className="nav">
      {items.map((item) => {
        const isActive = pathname === item.href;
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
