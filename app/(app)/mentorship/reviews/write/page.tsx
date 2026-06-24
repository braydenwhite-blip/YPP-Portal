import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { MentorshipReviewWriter } from "../_components/mentorship-review-writer";

export default async function WriteReviewPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("MENTOR") && !roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    redirect("/mentorship");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <a href="/mentorship/reviews" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Review Inbox
          </a>
          <p className="badge">Write Review</p>
          <h1 className="page-title">Monthly Review Writer</h1>
          <p className="page-subtitle">
            Write reviews directly or import from a PDF. All reviews require chair approval before being shared with mentees.
          </p>
        </div>
      </div>

      <MentorshipReviewWriter />
    </div>
  );
}