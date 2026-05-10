import Link from "next/link";

import { requireJourneyEditor } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

import { NewJourneyForm } from "./new-journey-form";

export const dynamic = "force-dynamic";

export default async function AdminJourneysPage() {
  const editor = await requireJourneyEditor();

  const journeys = await prisma.journey.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          status: true,
          updatedAt: true,
        },
      },
      assignmentRules: { select: { audience: true } },
      _count: { select: { versions: true } },
    },
  });

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Training Journeys</h1>
          <p className="muted">
            Author, version, and publish interactive training journeys.{" "}
            {editor.canPublish ? null : (
              <strong>Read-only — only ADMIN/CONTENT_ADMIN can edit or publish.</strong>
            )}
          </p>
        </div>
      </header>

      {editor.canPublish ? <NewJourneyForm /> : null}

      <section className="admin-table-wrap">
        {journeys.length === 0 ? (
          <p className="muted">No journeys yet. Create the first one above.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Latest version</th>
                <th>Status</th>
                <th>Audiences</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {journeys.map((j) => {
                const latest = j.versions[0];
                return (
                  <tr key={j.id}>
                    <td>{j.title}</td>
                    <td>
                      <code>{j.slug}</code>
                    </td>
                    <td>{latest ? `v${latest.versionNumber}` : "—"}</td>
                    <td>{latest ? <StatusPill status={latest.status} /> : "—"}</td>
                    <td>
                      {j.assignmentRules.length === 0
                        ? "—"
                        : j.assignmentRules.map((a) => a.audience).join(", ")}
                    </td>
                    <td>{new Date(j.updatedAt).toLocaleDateString()}</td>
                    <td>
                      <Link className="link" href={`/admin/journeys/${j.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const className =
    status === "PUBLISHED"
      ? "pill pill-success"
      : status === "DRAFT"
        ? "pill pill-pending"
        : "pill pill-muted";
  return <span className={className}>{status}</span>;
}
