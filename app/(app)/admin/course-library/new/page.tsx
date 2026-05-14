import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { CurriculumBuilderClient } from "@/app/(app)/instructor/curriculum-builder/client";

export default async function NewLibraryCoursePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/admin/course-library"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Course Library
        </Link>
      </div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Course Library</p>
          <h1 className="page-title">New library course</h1>
          <p className="page-subtitle">
            Build a ready-to-teach course. When saved it&rsquo;s published
            straight to the library so instructors can pick it from{" "}
            <Link href="/instructor/curriculum-builder" className="link">
              Curriculum Builder
            </Link>
            . You can unpublish or unlist it later.
          </p>
        </div>
      </div>
      <CurriculumBuilderClient libraryMode />
    </div>
  );
}
