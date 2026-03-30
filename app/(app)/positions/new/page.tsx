import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";

export default async function NewPositionRedirectPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (roles.includes("ADMIN")) {
    redirect("/admin/recruiting/positions/new");
  }

  if (roles.includes("CHAPTER_PRESIDENT")) {
    redirect("/chapter/recruiting/positions/new");
  }

  redirect("/positions");
}
