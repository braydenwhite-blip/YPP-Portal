"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePathwayReflection } from "@/lib/pathway-reflection-actions";

interface ReflectionFormProps {
  pathwayId: string;
  stepOrder: number;
  stepTitle: string;
}

export function ReflectionForm({ pathwayId, stepOrder, stepTitle }: ReflectionFormProps) {
  const [content, setContent] = useState("");
  const [visibleToMentor, setVisibleToMentor] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    startTransition(async () => {
      const result = await savePathwayReflection({
        pathwayId,
        stepOrder,
        content: content.trim(),
        visibleToMentor,
      });
      if (result && "error" in result && result.error) {
        alert(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  if (saved) {
    return (
      <div style={{ padding: "12px 16px", background: "var(--green-50, #f0fff4)", borderRadius: 10, color: "var(--green-700, #276749)", fontSize: 14 }}>
        ✓ Reflection saved for Step {stepOrder}: {stepTitle}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "var(--gray-50, #f9fafb)", padding: 16, borderRadius: 12, border: "1px solid var(--gray-200, #e2e8f0)" }}>
      <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8 }}>
        Step {stepOrder}: {stepTitle}
      </label>
      <textarea
        className="input"
        rows={3}
        placeholder="What did you learn? What surprised you? What will you apply next?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        style={{ width: "100%", marginBottom: 10 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={visibleToMentor}
              onChange={(e) => setVisibleToMentor(e.target.checked)}
            />
            Share with mentor
          </label>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--gray-500)" }}>
            Turn this off if you want to keep this reflection private to you.
          </div>
        </div>
        <button type="submit" className="button small" disabled={isPending || !content.trim()}>
          {isPending ? "Saving..." : "Save Reflection"}
        </button>
      </div>
    </form>
  );
}
