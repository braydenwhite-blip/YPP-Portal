import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { TemplateForm } from "../template-form";

export default async function NewWorkshopTemplatePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/admin/workshop-library"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Workshop Library
        </Link>
      </div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">New workshop</h1>
          <p className="page-subtitle">
            Save as <strong>Draft</strong> while you&rsquo;re iterating, then
            switch to <strong>Approved</strong> to publish to applicants.
          </p>
        </div>
      </div>
      <TemplateForm mode="create" />
    </div>
  );
}
