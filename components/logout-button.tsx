"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      className="button small ghost"
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      style={{ width: "100%" }}
    >
      Sign Out
    </button>
  );
}
