import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The card-based directory has been superseded by the unified Instructor
// Database at /admin/instructors. Preserve the old URL by redirecting.
export default function InstructorDirectoryPage() {
  redirect("/admin/instructors");
}
