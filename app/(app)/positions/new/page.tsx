import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function NewPositionRedirectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (roles.includes("ADMIN")) {
    redirect("/admin/recruiting/positions/new");
  }

  if (roles.includes("CHAPTER_LEAD")) {
    redirect("/chapter/recruiting/positions/new");
  }

  redirect("/positions");
}
