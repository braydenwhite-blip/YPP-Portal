"use client";

type AvatarSize = "sm" | "md" | "lg" | "xl";

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}

export default function UserAvatar({
  avatarUrl,
  userName,
  size = "md",
  className,
}: {
  avatarUrl?: string | null;
  userName?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const initials = getInitials(userName);
  const classes = `user-avatar user-avatar-${size}${className ? ` ${className}` : ""}`;

  if (avatarUrl) {
    return (
      <span className={classes}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={userName ? `${userName}'s avatar` : "User avatar"}
          className="user-avatar-img"
        />
      </span>
    );
  }

  return (
    <span className={classes} aria-label={userName ? `${userName}'s avatar` : "User avatar"}>
      <span className="user-avatar-initials">{initials}</span>
    </span>
  );
}
