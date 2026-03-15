"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { passionLabExamples } from "@/data/instructor-guide-examples";

type Template = {
  id: string;
  name: string;
  description: string | null;
  interestArea: string;
  difficulty: string | null;
  targetAgeGroup: string | null;
  templateCategory: string | null;
  sessionTopics: unknown;
};

type Props = {
  templates: Template[];
};

export function PassionLabTemplatesClient({ templates }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cloning, setCloning] = useState<string | null>(null);

  // Combine DB templates with built-in guide examples
  const builtInExamples = passionLabExamples.map((ex, idx) => ({
    id: `builtin-${idx}`,
    name: ex.title,
    description: ex.overview,
    interestArea: ex.fields.interestArea.value,
    difficulty: ex.fields.difficulty.value,
    targetAgeGroup: ex.fields.targetAgeGroup.value,
    sessionCount: ex.sessions.length,
    isBuiltIn: true as const,
  }));

  const dbTemplates = templates.map((t) => ({
    ...t,
    sessionCount: Array.isArray(t.sessionTopics)
      ? (t.sessionTopics as unknown[]).length
      : 0,
    isBuiltIn: false as const,
  }));

  const allTemplates = [...builtInExamples, ...dbTemplates];

  async function handleClone(templateId: string) {
    setCloning(templateId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/passion-lab-templates/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to clone template");
          setCloning(null);
          return;
        }
        const data = await res.json();
        router.push(`/instructor/passion-lab-builder?id=${data.programId}`);
      } catch {
        alert("Failed to clone template");
        setCloning(null);
      }
    });
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              Passion Lab Templates
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              Start from a proven template. Clone it and make it your own.
            </p>
          </div>
          <a
            href="/instructor/passion-lab-builder"
            className="button outline small"
            style={{ textDecoration: "none" }}
          >
            Start from Scratch
          </a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {allTemplates.map((template) => (
          <div
            key={template.id}
            className="card"
            style={{
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{template.name}</h3>
              {template.isBuiltIn && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--ypp-purple-50, #f3f0ff)",
                    color: "var(--ypp-purple)",
                  }}
                >
                  EXAMPLE
                </span>
              )}
            </div>

            <p
              style={{
                fontSize: 12,
                color: "var(--muted)",
                lineHeight: 1.5,
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {template.description}
            </p>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--surface-alt)",
                  color: "var(--muted)",
                }}
              >
                {template.interestArea}
              </span>
              {template.difficulty && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--surface-alt)",
                    color: "var(--muted)",
                  }}
                >
                  {template.difficulty}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--surface-alt)",
                  color: "var(--muted)",
                }}
              >
                {template.sessionCount} sessions
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="button primary small"
                onClick={() => handleClone(template.id)}
                disabled={isPending && cloning === template.id}
              >
                {isPending && cloning === template.id
                  ? "Cloning..."
                  : "Use This Template"}
              </button>
              {template.isBuiltIn && (
                <a
                  href="/instructor/guide?tab=passion-labs"
                  className="button outline small"
                  style={{ textDecoration: "none" }}
                >
                  See Full Example
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {allTemplates.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
          No templates available yet. Check back soon!
        </div>
      )}
    </div>
  );
}
