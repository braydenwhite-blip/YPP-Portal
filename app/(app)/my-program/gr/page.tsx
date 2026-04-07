import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import GRDocumentView from "@/components/gr/gr-document-view";
import Link from "next/link";

export const metadata = { title: "My G&R — Goals & Responsibilities" };

export default async function MyGRPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  const doc = await getMyGRDocument();

  if (!doc) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Mentorship Program</p>
            <h1 className="page-title">My Goals & Responsibilities</h1>
          </div>
        </div>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--muted)", marginBottom: "1rem" }}>
            You don&apos;t have a G&R document assigned yet.
          </p>
          <p style={{ color: "var(--muted)" }}>
            Your program administrator will assign a Goals & Responsibilities document to you
            once your mentorship pairing is established.
          </p>
          <Link href="/my-program" className="button primary" style={{ marginTop: "1.5rem" }}>
            Back to My Program
          </Link>
        </div>
      </div>
    );
  }

  const serialized = {
    id: doc.id,
    templateTitle: doc.template.title,
    roleType: doc.template.roleType,
    roleMission: doc.roleMission,
    status: doc.status,
    roleStartDate: doc.roleStartDate.toISOString(),
    mentorName: doc.mentorship.mentor.name,
    mentorEmail: doc.mentorship.mentor.email,
    mentorInfo: doc.mentorInfo as Record<string, string> | null,
    officerInfo: doc.officerInfo as Record<string, string> | null,
    goals: doc.goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      timePhase: g.timePhase,
      isCustom: g.isCustom,
      kpiValues: g.kpiValues.map((v) => ({
        value: v.value,
        measuredAt: v.measuredAt.toISOString(),
        notes: v.notes,
      })),
    })),
    successCriteria: doc.successCriteria.map((sc) => ({
      timePhase: sc.timePhase,
      criteria: sc.criteria,
    })),
    resources: doc.resources.map((r) => ({
      title: r.resource.title,
      url: r.resource.url,
      description: r.resource.description,
    })),
    plansOfAction: doc.plansOfAction.map((p) => ({
      cycleNumber: p.cycleNumber,
      content: p.content,
      updatedAt: p.updatedAt.toISOString(),
    })),
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">My Goals & Responsibilities</h1>
          <p className="page-subtitle">{doc.template.title}</p>
        </div>
      </div>

      <GRDocumentView document={serialized} isOwner={true} />
    </div>
  );
}
