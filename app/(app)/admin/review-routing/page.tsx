import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  createReviewRoutingException,
  deactivateReviewRoutingException,
} from "@/lib/org/review-routing-actions";

export default async function ReviewRoutingPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const exceptions = await prisma.reviewRoutingException.findMany({
    where: { isActive: true },
    include: {
      mentor: { select: { name: true, email: true } },
      mentee: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Review Routing Exceptions</h1>
          <p className="page-subtitle">
            Carve-outs for who may finalize a review — self-finalize approvals and
            routes that require Board sign-off. These merge with the code-defined
            defaults; nothing here removes what&apos;s already configured.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Add Exception</h3>
        <form action={createReviewRoutingException} className="form-grid">
          <label className="form-row">
            Kind
            <select className="input" name="kind" defaultValue="SELF_FINALIZE">
              <option value="SELF_FINALIZE">Self-finalize (mentor may finalize their own draft)</option>
              <option value="BOARD_APPROVAL">Board approval required</option>
            </select>
          </label>
          <label className="form-row">
            Mentor Email
            <input className="input" name="mentorEmail" type="email" required />
          </label>
          <label className="form-row">
            Mentee Email (leave blank only for a &quot;top instructors&quot; board route)
            <input className="input" name="menteeEmail" type="email" />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" name="topInstructionMentees" />
            Applies to any top-instruction-ladder mentee under this mentor (Board approval only)
          </label>
          <label className="form-row">
            Note
            <input className="input" name="note" placeholder="Why this exception exists" />
          </label>
          <label className="form-row">
            Effective From (optional)
            <input className="input" name="effectiveFrom" type="date" />
          </label>
          <button type="submit" className="button primary">Add Exception</button>
        </form>
      </div>

      <div>
        <div className="section-title">Active Exceptions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {exceptions.length === 0 && (
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              No admin-added exceptions yet — the built-in defaults from
              lib/org/review-exceptions.ts still apply.
            </p>
          )}
          {exceptions.map((exception) => (
            <div key={exception.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div>
                  <span className="pill">{exception.kind === "SELF_FINALIZE" ? "Self-Finalize" : "Board Approval"}</span>
                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    <strong>{exception.mentor?.name ?? exception.mentorName ?? "Unknown mentor"}</strong>
                    {" → "}
                    {exception.topInstructionMentees
                      ? "any top-instruction-ladder mentee"
                      : exception.mentee?.name ?? exception.menteeName ?? "Unknown mentee"}
                  </div>
                  {exception.note && (
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>{exception.note}</p>
                  )}
                </div>
                <form action={deactivateReviewRoutingException.bind(null, exception.id)}>
                  <button type="submit" className="button secondary small">Deactivate</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
