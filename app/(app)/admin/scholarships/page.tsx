import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ScholarshipManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Scholarship Portal Management</h1>
        </div>
        <Link href="/admin/scholarships/create" className="button primary">
          Create Scholarship
        </Link>
      </div>

      <div className="card">
        <h3>Coming Soon</h3>
        <p>
          Scholarship models and admin workflows are not wired up yet. This page will be enabled
          once we add the corresponding Prisma models (and migrations) for scholarships and applications.
        </p>
      </div>
    </div>
  );
}

