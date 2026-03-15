import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getFormTemplates, createFormTemplate } from "@/lib/form-template-actions";
import { FormTemplateBuilder } from "@/components/form-template-builder";

export default async function AdminFormTemplatesPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const templates = await getFormTemplates();

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Application Form Templates</h1>
          <p className="page-subtitle">
            Configure the questions applicants see when applying for instructor or chapter president positions.
          </p>
        </div>
      </div>

      {/* Create New Template */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">Create New Template</div>
        <form action={createFormTemplate} className="form-grid">
          <div className="grid two">
            <div className="form-row">
              <label>Template Name</label>
              <input
                className="input"
                name="name"
                required
                placeholder="e.g., Instructor Application Spring 2026"
              />
            </div>
            <div className="form-row">
              <label>Application Type</label>
              <select className="input" name="roleType" required>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="CHAPTER_PRESIDENT">Chapter President</option>
              </select>
            </div>
          </div>
          <button type="submit" className="button small">
            Create Template
          </button>
        </form>
      </div>

      {/* Template List */}
      {templates.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>
            No form templates created yet. Create one above to get started.
          </p>
        </div>
      ) : (
        templates.map((template) => (
          <FormTemplateBuilder key={template.id} template={template} />
        ))
      )}
    </div>
  );
}
