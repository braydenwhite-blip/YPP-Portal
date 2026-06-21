import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { getMissingChapterQueue } from "@/lib/org/missing-chapter";
import { assignMissingChapter } from "@/lib/org/missing-chapter-actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Missing Chapter Resolution" };

function recordTypeLabel(recordType: string): string {
  return recordType
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export default async function MissingChapterResolutionPage() {
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const [rows, chapters] = await Promise.all([
    getMissingChapterQueue(),
    prisma.chapter.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="page-shell" style={{ maxWidth: 920 }}>
      <p className="badge">Operating queues</p>
      <h1 className="page-title" style={{ margin: "8px 0 4px" }}>
        Missing Chapter Resolution
      </h1>
      <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 14 }}>
        Assign each record to the correct chapter. Resolving a row also completes
        the related Missing Chapter action.
      </p>

      {rows.length === 0 ? (
        <section className="card" style={{ padding: "18px 20px" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>No Missing Chapter records</h2>
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Everything currently has a chapter or is intentionally global.
          </p>
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((row) => (
            <section
              key={row.id}
              id={row.id}
              className="card"
              style={{ padding: "16px 18px", scrollMarginTop: 96 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 16, overflowWrap: "anywhere" }}>
                    {row.label}
                  </h2>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                    {recordTypeLabel(row.recordType)} · missing for {row.ageLabel}
                  </p>
                </div>
                {row.actionItemId ? (
                  <Link href={`/actions/${row.actionItemId}`} className="button outline small">
                    View action
                  </Link>
                ) : null}
              </div>

              <form
                action={assignMissingChapter}
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                <input type="hidden" name="recordType" value={row.recordType} />
                <input type="hidden" name="recordId" value={row.recordId} />
                <label style={{ fontSize: 13, fontWeight: 600, flex: "1 1 220px" }}>
                  Chapter
                  <select
                    name="chapterId"
                    required
                    style={{ display: "block", width: "100%", marginTop: 4 }}
                    disabled={chapters.length === 0}
                  >
                    <option value="">Select chapter...</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn" disabled={chapters.length === 0}>
                  Assign chapter
                </button>
              </form>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
