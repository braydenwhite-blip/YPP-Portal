"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { signOutLegacyBypass } from "@/lib/legacy-auth-actions";

export default function LogoutButton({
  className = "button small ghost",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await Promise.allSettled([supabase.auth.signOut(), signOutLegacyBypass()]);
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className={className}
      type="button"
      onClick={handleSignOut}
      style={{ width: "100%", ...style }}
    >
      Sign Out
    </button>
  );
}
