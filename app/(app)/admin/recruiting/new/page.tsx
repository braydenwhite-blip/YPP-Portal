import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/page-guards";

export default async function AdminRecruitingNewAliasPage() {
  await requireAdminPage();
  redirect("/admin/recruiting/positions/new");
}
