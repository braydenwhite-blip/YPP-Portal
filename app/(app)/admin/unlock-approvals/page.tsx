import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  getPendingRecommendations,
  approveUnlockRecommendation,
  denyUnlockRecommendation,
} from "@/lib/unlock-manager";
import { revalidatePath } from "next/cache";

const SECTION_LABELS: Record<string, string> = {
  challenges: "Challenges",
  projects: "Projects",
  people_support: "People & Support",
  opportunities: "Opportunities",
};

export default async function UnlockApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return (
      <div>
        <h1 className="page-title">Access Denied</h1>
        <p>Only admins can approve unlock recommendations.</p>
      </div>
    );
  }

  let recommendations: Awaited<ReturnType<typeof getPendingRecommendations>> =
    [];
  try {
    recommendations = await getPendingRecommendations();
  } catch {
    // Tables may not exist yet
  }

  async function handleApprove(formData: FormData) {
    "use server";
    const sess = await getServerSession(authOptions);
    if (!sess?.user?.id) return;

    const id = formData.get("recommendationId") as string;
    await approveUnlockRecommendation(id);
    revalidatePath("/admin/unlock-approvals");
  }

  async function handleDeny(formData: FormData) {
    "use server";
    const sess = await getServerSession(authOptions);
    if (!sess?.user?.id) return;

    const id = formData.get("recommendationId") as string;
    await denyUnlockRecommendation(id);
    revalidatePath("/admin/unlock-approvals");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Unlock Approvals</h1>
          <p className="page-subtitle">
            Review and approve section unlock recommendations from mentors.
          </p>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)" }}>
            No pending unlock recommendations. When mentors recommend unlocking
            advanced sections for their mentees, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {rec.mentor.name} recommends unlocking{" "}
                  <strong>
                    {SECTION_LABELS[rec.sectionKey] ?? rec.sectionKey}
                  </strong>{" "}
                  for {rec.student.name}
                </p>
                {rec.reason && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 13,
                      color: "var(--muted)",
                    }}
                  >
                    Reason: {rec.reason}
                  </p>
                )}
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "var(--gray-400)",
                  }}
                >
                  Submitted{" "}
                  {new Date(rec.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <form action={handleApprove}>
                  <input
                    type="hidden"
                    name="recommendationId"
                    value={rec.id}
                  />
                  <button type="submit" className="button small">
                    Approve
                  </button>
                </form>
                <form action={handleDeny}>
                  <input
                    type="hidden"
                    name="recommendationId"
                    value={rec.id}
                  />
                  <button
                    type="submit"
                    className="button outline small"
                    style={{ color: "var(--red-600, #dc2626)" }}
                  >
                    Deny
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
