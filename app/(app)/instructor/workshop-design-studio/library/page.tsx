import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { getWorkshopStudioGateStatus } from "@/lib/workshop-proposal-access";
import {
  difficultyLabel,
  isSubmissionEditable,
} from "@/lib/workshop-proposal-constants";
import { getOrCreateApplicantSubmission } from "@/lib/workshop-proposal-actions";
import { LibraryFilters } from "./filters";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function WorkshopLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const gate = await getWorkshopStudioGateStatus(userId, roles);
  if (!gate.unlocked) {
    if (gate.reason === "WRONG_SUBTYPE") {
      redirect("/instructor/lesson-design-studio");
    }
    redirect("/instructor-training?locked=workshop-design-studio");
  }

  const params = (await searchParams) ?? {};
  const search = pickString(params.q).toLowerCase().trim();
  const categoryFilter = pickString(params.category).trim();
  const difficultyFilter = pickString(params.difficulty).trim();

  const [templates, submission] = await Promise.all([
    withPrismaFallback(
      "workshop-library:templates",
      () =>
        prisma.workshopProposalTemplate.findMany({
          where: { status: "APPROVED" },
          orderBy: [{ category: "asc" }, { title: "asc" }],
        }),
      []
    ),
    gate.reason === "REVIEWER_BYPASS"
      ? Promise.resolve(null)
      : withPrismaFallback(
          "workshop-library:submission",
          () => getOrCreateApplicantSubmission(),
          null
        ),
  ]);

  const allCategories = Array.from(
    new Set(templates.map((t) => t.category).filter(Boolean))
  ).sort();

  const filtered = templates.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (difficultyFilter && t.difficulty !== difficultyFilter) return false;
    if (search) {
      const haystack =
        `${t.title} ${t.category} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const editable = submission ? isSubmissionEditable(submission.status) : true;
  const selectedTemplateId =
    submission && submission.sourceType === "TEMPLATE_SELECTION"
      ? submission.templateId
      : null;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/instructor/workshop-design-studio"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Workshop Design Studio
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">Workshop Design Studio · Library</p>
          <h1 className="page-title">Pick an approved workshop</h1>
          <p className="page-subtitle">
            Skim the library, preview a workshop, and pick the one you&rsquo;d
            be strongest teaching. You&rsquo;ll answer four reflection
            questions about how you&rsquo;d run it.
          </p>
        </div>
      </div>

      <LibraryFilters
        categories={allCategories}
        currentSearch={search}
        currentCategory={categoryFilter}
        currentDifficulty={difficultyFilter}
      />

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <h3 style={{ marginTop: 0 }}>No workshops match those filters</h3>
          <p style={{ color: "var(--muted)" }}>
            Clear filters or try different keywords. Admins keep the library
            up to date — new approved workshops show up here automatically.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((t) => {
            const isSelected = selectedTemplateId === t.id;
            return (
              <article
                key={t.id}
                className="card"
                style={{
                  borderColor: isSelected ? "var(--ypp-purple)" : "var(--border)",
                  borderWidth: isSelected ? 2 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16 }}>{t.title}</h3>
                  {isSelected ? (
                    <span className="pill pill-small pill-success">Selected</span>
                  ) : null}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--muted)",
                    lineHeight: 1.45,
                  }}
                >
                  {t.category} · {t.targetAgeRange} · {t.estimatedMinutes} min ·{" "}
                  {difficultyLabel(t.difficulty)}
                </p>
                <p
                  style={{
                    margin: "10px 0 12px",
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  {t.description}
                </p>
                {t.tags.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="pill pill-small"
                        style={{ background: "var(--surface-alt)", fontSize: 11 }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link
                    href={`/instructor/workshop-design-studio/library/${t.id}`}
                    className="button small"
                    style={{ textDecoration: "none" }}
                  >
                    {isSelected ? "Open & continue" : "Preview & pick"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!editable && submission ? (
        <div className="card" style={{ marginTop: 20, background: "#fffbeb" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            Your submission is locked while a reviewer takes a look. Browse the
            library all you want — you can&rsquo;t change your selection until
            review wraps.
          </p>
        </div>
      ) : null}
    </div>
  );
}
