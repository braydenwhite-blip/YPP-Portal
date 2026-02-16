import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function AdminPositionsNewAliasPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  redirect("/admin/recruiting/positions/new");
}
