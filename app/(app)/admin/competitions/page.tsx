import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPendingInstructorCompetitionDrafts, publishCompetitionDraft } from "@/lib/competition-draft-actions";
import { hasCompetitionDraftOwnership } from "@/lib/schema-compat";

async function publishDraftAction(formData: FormData) {
  "use server";
  const id = String(formData.get("competitionId") || "");
  if (!id) throw new Error("Competition id required");
  await publishCompetitionDraft(id);
}

export default async function AdminCompetitionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/dashboard");
  const hasDraftSupport = await hasCompetitionDraftOwnership();

  const [pendingDrafts, rawCompetitions] = await Promise.all([
    hasDraftSupport ? getPendingInstructorCompetitionDrafts() : Promise.resolve([]),
    prisma.seasonalCompetition.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        season: true,
        theme: true,
        status: true,
        startDate: true,
        endDate: true,
        passionArea: true,
        createdAt: true,
        ...(hasDraftSupport
          ? {
              createdById: true,
              createdBy: { select: { id: true, name: true } },
            }
          : {}),
        _count: { select: { entries: true } },
      },
    }),
  ]);
  const allCompetitions = rawCompetitions.map((competition) => ({
    ...competition,
    createdById: "createdById" in competition ? competition.createdById : null,
    createdBy: "createdBy" in competition ? competition.createdBy : null,
  }));

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 className="page-title" style={{ marginBottom: 24 }}>Competition Management</h1>

      {!hasDraftSupport && (
        <div
          className="card"
          style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", marginBottom: 24 }}
        >
          Instructor-owned competition drafts are hidden on this deployment until the latest
          competition database migration is applied.
        </div>
      )}

      {/* ── Instructor Drafts Pending Review ─────────────────────── */}
      {pendingDrafts.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              Instructor Drafts — Pending Review
            </h2>
            <span
              style={{
                background: "#fff3e0",
                color: "#e65100",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
              }}
            >
              {pendingDrafts.length} pending
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingDrafts.map((c) => (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: "14px 18px",
                  border: "1px solid #ffb74d",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{c.theme}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span>Season: {c.season}</span>
                    {c.passionArea && <span>Area: {c.passionArea}</span>}
                    <span>
                      {new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}
                    </span>
                    <span>Submitted by: <strong>{c.createdBy?.name ?? "Unknown"}</strong></span>
                    <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Quick criteria preview */}
                  {Array.isArray(c.judgingCriteria) && c.judgingCriteria.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                      Criteria: {(c.judgingCriteria as Array<{ name: string }>).map((cr) => cr.name).join(", ")}
                    </div>
                  )}
                </div>

                <form action={publishDraftAction} style={{ flexShrink: 0 }}>
                  <input type="hidden" name="competitionId" value={c.id} />
                  <button type="submit" className="button primary small">
                    Publish →
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {pendingDrafts.length === 0 && (
        <div
          style={{
            padding: "12px 18px",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 32,
          }}
        >
          No instructor competition drafts pending review.
        </div>
      )}

      {/* ── All Competitions ──────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>All Competitions</h2>

        {allCompetitions.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--muted)" }}>No competitions yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allCompetitions.map((c) => {
              const statusColors: Record<string, string> = {
                UPCOMING: "#6b7280",
                OPEN_FOR_SUBMISSIONS: "#16a34a",
                JUDGING: "#2563eb",
                VOTING: "#7c3aed",
                COMPLETED: "#9ca3af",
              };
              const isDraft = c.status === "UPCOMING" && c.createdById;

              return (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    padding: "12px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.theme}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, display: "flex", gap: 12 }}>
                      <span>{c.season}</span>
                      <span
                        style={{
                          padding: "1px 8px",
                          borderRadius: "var(--radius-full)",
                          background: statusColors[c.status] + "20",
                          color: statusColors[c.status],
                          fontWeight: 600,
                        }}
                      >
                        {isDraft ? "Draft (instructor)" : c.status.replace(/_/g, " ")}
                      </span>
                      <span>{c._count.entries} entries</span>
                      {c.createdBy && <span>By: {c.createdBy.name}</span>}
                    </div>
                  </div>
                  <a
                    href={`/competitions/${c.id}`}
                    className="button outline small"
                    style={{ textDecoration: "none" }}
                  >
                    View
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
