import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { createMentorshipRequest } from "@/lib/mentorship-hub-actions";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "Get Help — My Mentor" };

async function submitHelpRequest(formData: FormData) {
  "use server";
  await createMentorshipRequest(formData);
  redirect("/my-mentor/help?sent=1");
}

export default async function GetHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const justSent = params?.sent === "1";

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Mentor</p>
          <h1 className="page-title">Get Help</h1>
          <p className="page-subtitle">Stuck or unsure? Reaching out is always the right move.</p>
        </div>
      </div>

      <MyMentorSubnav />

      {justSent && (
        <div
          className="card"
          style={{ marginBottom: 16, borderLeft: "4px solid #16a34a", background: "#f0fdf4" }}
        >
          <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#166534" }}>
            Sent to your mentor. They&apos;ll follow up with you — no need to do anything else right
            now.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        <section className="card" style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Quick ways to get unstuck</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/my-mentor/schedule" className="button secondary small">
              Schedule time with your mentor
            </Link>
            <Link href="/my-mentor/goals" className="button secondary small">
              Review your goals
            </Link>
            <Link href="/my-mentor/resources" className="button secondary small">
              Browse your resources
            </Link>
          </div>
        </section>

        <section className="card" style={{ display: "grid", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Ask your mentor a question</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
              This goes privately to your mentor. There&apos;s no wrong question — asking early is a
              sign of a strong instructor, not a struggling one.
            </p>
          </div>
          <form action={submitHelpRequest} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="visibility" value="PRIVATE" />
            <input type="hidden" name="kind" value="GENERAL_QNA" />
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>What do you need help with?</span>
              <input
                name="title"
                required
                maxLength={140}
                placeholder="e.g. I'm not sure how to plan my next session"
                style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Add any details (optional)</span>
              <textarea
                name="details"
                rows={4}
                placeholder="The more context you share, the better your mentor can help."
                style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", resize: "vertical" }}
              />
            </label>
            <div>
              <button type="submit" className="button">
                Send to my mentor
              </button>
            </div>
          </form>
        </section>

        <section
          className="card"
          style={{ background: "var(--surface-alt, #f8fafc)", fontSize: "0.82rem" }}
        >
          <p style={{ margin: 0 }}>
            <strong>Who sees this?</strong> Only your mentor (and program admins, if it needs
            escalation). It is never shown to other instructors or students.
          </p>
        </section>
      </div>
    </div>
  );
}
