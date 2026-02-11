import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ManageOfficeHoursPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";
  if (!isInstructor) {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Manage Office Hours</h1>
        </div>
      </div>

      <div className="card">
        <h3>Coming Soon</h3>
        <p>
          Office hours management is not enabled yet. This page will be wired up once we finish the
          booking flow and instructor scheduling UI.
        </p>
      </div>
    </div>
  );
}

