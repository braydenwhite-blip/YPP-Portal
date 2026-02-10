import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PathwayTrackingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Pathway Completion Tracking</h1>
        </div>
      </div>

      <div className="card">
        <h3>Coming Soon</h3>
        <p>
          Pathway progress tracking is not enabled yet. This page will be wired up once
          we add a dedicated progress model (and migrations) for tracking milestones and completion.
        </p>
      </div>
    </div>
  );
}

