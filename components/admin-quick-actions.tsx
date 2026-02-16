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
  const menuId = "admin-quick-actions-menu";

  return (
    <div className="admin-quick-actions">
      <button
        type="button"
        className="admin-quick-actions-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Admin Quick Actions"
        aria-label="Toggle admin quick actions"
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        {isOpen ? "X" : "+"}
      </button>
      {isOpen && (
        <div id={menuId} className="admin-quick-actions-menu" role="menu" aria-label="Admin quick actions">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="admin-quick-action-item"
              role="menuitem"
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
