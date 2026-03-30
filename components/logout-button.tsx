"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

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
    await supabase.auth.signOut();
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
