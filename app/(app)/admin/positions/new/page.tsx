import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";

export default async function AdminPositionsNewAliasPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  redirect("/admin/recruiting/positions/new");
}
