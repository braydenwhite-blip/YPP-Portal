import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CreateEventPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  const chapters = await prisma.chapter.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Create Event</h1>
        </div>
      </div>

      <div className="card">
        <h3>Create New Event</h3>
        <form action="/api/admin/events/create" method="POST" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Event Title *
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder="e.g., Spring Showcase 2026"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="Event description and details..."
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Event Type *
            </label>
            <select
              name="eventType"
              required
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
            >
              <option value="">Select type</option>
              <option value="SHOWCASE">Showcase</option>
              <option value="FESTIVAL">Festival</option>
              <option value="COMPETITION">Competition</option>
              <option value="WORKSHOP">Workshop</option>
              <option value="ALUMNI_EVENT">Alumni Event</option>
            </select>
          </div>

          <div className="grid two" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                name="startDate"
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                End Date & Time *
              </label>
              <input
                type="datetime-local"
                name="endDate"
                required
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Location
            </label>
            <input
              type="text"
              name="location"
              placeholder="e.g., Main Campus or Virtual (Zoom link)"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Chapter
            </label>
            <select
              name="chapterId"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
            >
              <option value="">All Chapters</option>
              {chapters.map(chapter => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="isAlumniOnly" value="true" />
              <span style={{ fontSize: 14 }}>Alumni-only event</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="button primary">
              Create Event
            </button>
            <Link href="/admin/events" className="button secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
