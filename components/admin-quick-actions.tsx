"use client";

import Link from "next/link";
import { useState } from "react";

const QUICK_ACTIONS = [
  { href: "/admin", label: "Dashboard", icon: "D" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "A" },
  { href: "/admin/waitlist", label: "Waitlist", icon: "W" },
  { href: "/admin/instructor-readiness", label: "Instructor Readiness", icon: "I" },
  { href: "/admin/parent-approvals", label: "Parent Approvals", icon: "P" },
  { href: "/admin/export", label: "Data Export", icon: "E" },
  { href: "/admin/announcements", label: "Announcements", icon: "N" },
  { href: "/admin/students", label: "Students", icon: "S" },
  { href: "/admin/training", label: "Training", icon: "T" },
];

export default function AdminQuickActions() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="admin-quick-actions">
      <button
        className="admin-quick-actions-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Admin Quick Actions"
      >
        {isOpen ? "X" : "+"}
      </button>
      {isOpen && (
        <div className="admin-quick-actions-menu">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="admin-quick-action-item"
              onClick={() => setIsOpen(false)}
            >
              <span className="admin-quick-action-icon">{action.icon}</span>
              <span className="admin-quick-action-label">{action.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
