import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import ChapterPresidentApplicationForm from "@/components/chapter-president-application-form";
import Link from "next/link";

export default async function ApplyChapterPresidentPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  // Check if user already has an application
  const existing = await prisma.chapterPresidentApplication.findUnique({
    where: { applicantId: session.user.id },
  });

  if (existing) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="badge">Chapter Presidentership</p>
            <h1 className="page-title">Apply for Chapter President</h1>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ marginBottom: 16 }}>
            You already have a chapter president application on file.
          </p>
          <Link
            href="/application-status"
            className="button"
            style={{ display: "inline-block", textDecoration: "none" }}
          >
            View Application Status
          </Link>
        </div>
      </div>
    );
  }

  // Fetch chapters for the dropdown
  const chapters = await prisma.chapter.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Fetch active custom form fields for CHAPTER_PRESIDENT role
  const template = await prisma.applicationFormTemplate.findFirst({
    where: { roleType: "CHAPTER_PRESIDENT", isActive: true },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
    },
  });

  const customFields = (template?.fields ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    fieldType: f.fieldType,
    required: f.required,
    placeholder: f.placeholder,
    helpText: f.helpText,
    options: f.options,
  }));

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="badge">Chapter Presidentership</p>
          <h1 className="page-title">Apply for Chapter President</h1>
          <p className="page-subtitle">
            Submit your application to lead a YPP chapter. The review process
            typically takes 7-14 days.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>How it works</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { step: "1", text: "Submit your application with leadership experience, chapter vision, and availability." },
            { step: "2", text: "An admin reviews your application and schedules an interview to discuss your vision." },
            { step: "3", text: "If approved, you are assigned as chapter president and begin onboarding." },
          ].map((item) => (
            <div
              key={item.step}
              style={{ display: "flex", gap: 12, alignItems: "center" }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#f0e6ff",
                  color: "#6b21c8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {item.step}
              </div>
              <span style={{ fontSize: 14 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <ChapterPresidentApplicationForm
          chapters={chapters}
          customFields={customFields}
        />
      </div>
    </div>
  );
}
