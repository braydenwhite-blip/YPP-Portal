import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "My Resources — My Mentor" };

export default async function MyResourcesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  const doc = await getMyGRDocument();
  const resources = doc?.resources ?? [];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Mentor</p>
          <h1 className="page-title">My Resources</h1>
          <p className="page-subtitle">Materials your mentor recommends to help you grow.</p>
        </div>
      </div>

      <MyMentorSubnav />

      <div
        className="card"
        style={{ marginBottom: 16, borderLeft: "4px solid var(--color-primary)" }}
      >
        <p style={{ margin: 0, fontSize: "0.85rem" }}>
          These are picked for where you are right now. New ones may appear after each monthly
          review — your mentor adds resources that match your goals.
        </p>
      </div>

      {resources.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
          <p style={{ fontWeight: 600, margin: "0 0 6px" }}>No resources yet</p>
          <p className="muted" style={{ margin: "0 auto", maxWidth: 380, fontSize: 13 }}>
            Once your mentor recommends resources, they&apos;ll show up here. You can always ask for
            something specific on the Get Help page.
          </p>
          <Link href="/my-mentor/help" className="button small" style={{ marginTop: 16 }}>
            Ask for a resource
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {resources.map((r, i) => (
            <div key={`${r.resource.url}-${i}`} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>{r.resource.title}</strong>
                  {r.resource.description && (
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                      {r.resource.description}
                    </p>
                  )}
                </div>
                {r.resource.url && (
                  <a
                    href={r.resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button secondary small"
                    style={{ flexShrink: 0 }}
                  >
                    Open →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
