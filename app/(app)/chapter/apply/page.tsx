import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { ensureOperatingChapters } from "@/lib/chapters/operating";
import ChapterPresidentApplicationForm from "@/components/chapter-president-application-form";
import { ChapterOpportunity } from "@/components/chapters/chapter-opportunity";
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
            <p className="badge">Chapter Leadership</p>
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
  await ensureOperatingChapters();
  const chapters = await prisma.chapter.findMany({
    where: { archivedAt: null },
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
      <div style={{ marginBottom: 16 }}>
        <ChapterOpportunity showApply={false} />
      </div>
      <div className="page-header">
        <div>
          <p className="badge">Chapter Leadership</p>
          <h1 className="page-title">Apply for Chapter President</h1>
          <p className="page-subtitle">
            Part of the YPP application for open roles. Start with basics and your resume;
            we&apos;ll ask follow-up questions after review if it looks like a fit.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>How it works</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            {
              step: "1",
              text: "Submit basic info and your resume — one application covers instructor, chapter president, and technology manager interest.",
            },
            {
              step: "2",
              text: "If it looks like a fit, we’ll ask follow-up prompts: one required for everyone, plus up to four optional specialty prompts.",
            },
            {
              step: "3",
              text: "We’ll place you in the right queue based on your interests and our openings, then follow up about interviews or onboarding.",
            },
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
      />
      </div>
    </div>
  );
}
