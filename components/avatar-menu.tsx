"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import UserAvatar from "@/components/user-avatar";

export default function AvatarMenu({
  userName,
  primaryRole,
  avatarUrl,
  hasUnreadNotifications,
}: {
  userName?: string | null;
  primaryRole?: string | null;
  avatarUrl?: string | null;
  hasUnreadNotifications?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  // Focus first item when opening, return focus when closing
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLElement>("[role=menuitem]");
      firstItem?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]");
        if (!items?.length) return;

        const current = document.activeElement;
        let idx = Array.from(items).indexOf(current as HTMLElement);
        if (e.key === "ArrowDown") {
          idx = idx < items.length - 1 ? idx + 1 : 0;
        } else {
          idx = idx > 0 ? idx - 1 : items.length - 1;
        }
        items[idx].focus();
      }
    },
    [isOpen],
  );

  return (
    <div className="avatar-menu-wrapper">
      <div className="avatar-menu-container" ref={wrapperRef} onKeyDown={handleKeyDown}>
        <button
          ref={triggerRef}
          className="avatar-menu-trigger"
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="User menu"
        >
          <UserAvatar avatarUrl={avatarUrl} userName={userName} size="sm" />
          {hasUnreadNotifications && <span className="avatar-notification-dot" />}
        </button>

        {isOpen && (
          <div className="avatar-dropdown" role="menu" ref={menuRef}>
            <div className="avatar-dropdown-header">
              <p className="user-name">{userName ?? "Portal User"}</p>
              <p className="user-role">
                {primaryRole ? primaryRole.replace("_", " ") : "Portal Access"}
              </p>
            </div>
            <Link
              href="/profile"
              className="avatar-dropdown-item"
              role="menuitem"
              tabIndex={-1}
              onClick={() => setIsOpen(false)}
            >
              My Profile
            </Link>
            <Link
              href="/settings/personalization"
              className="avatar-dropdown-item"
              role="menuitem"
              tabIndex={-1}
              onClick={() => setIsOpen(false)}
            >
              Settings
            </Link>
            <div className="avatar-dropdown-divider" />
            <button
              className="avatar-dropdown-item"
              role="menuitem"
              tabIndex={-1}
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
