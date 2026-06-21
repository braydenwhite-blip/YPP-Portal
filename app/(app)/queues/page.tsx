import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getOperationalQueues } from "@/lib/org/operational-queues";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Queues" };

/**
 * Operational queues overview (Phase 7 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md). Surfaces the proposal's
 * required queues for the signed-in user.
 */
export default async function QueuesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?next=/queues");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { chapterId: true },
  });

  const lanes = await getOperationalQueues({
    id: session.user.id,
    roles: session.user.roles ?? [],
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes ?? [],
    chapterId: me?.chapterId ?? null,
  });

  return (
    <div className="page-shell" style={{ maxWidth: 880 }}>
      <p className="badge">Operating queues</p>
      <h1 className="page-title" style={{ margin: "8px 0 4px" }}>
        My Queues
      </h1>
      <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 14 }}>
        The work waiting on you across reviews, curriculum, interviews, and chapter setup.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {lanes.map((lane) => (
          <section key={lane.key} className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{lane.label}</h2>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>{lane.count}</span>
            </div>

            {lane.rows.length === 0 ? (
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Nothing in this queue right now.
              </p>
            ) : (
              <ul
                style={{
                  margin: "10px 0 0",
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {lane.rows.slice(0, 20).map((row) => {
                  const body = (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {row.title}
                        {row.ageLabel ? (
                          <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {row.ageLabel}</span>
                        ) : null}
                      </div>
                      {row.subtitle ? (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{row.subtitle}</div>
                      ) : null}
                    </>
                  );
                  return (
                    <li key={row.id} style={{ borderTop: "1px solid var(--ps-border, #eee)", paddingTop: 8 }}>
                      {row.href ? (
                        <Link href={row.href} style={{ textDecoration: "none", color: "inherit" }}>
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
