"use client";

import { useState } from "react";
import { applyPortfolioTemplate } from "@/lib/real-world-actions";
import { useRouter } from "next/navigation";

export function ApplyTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleApply() {
    if (!confirm(`Apply the "${templateName}" template? This will update your portfolio layout and sections.`)) return;
    setLoading(true);
    try {
      await applyPortfolioTemplate(templateId);
      router.push("/portfolio");
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  return (
    <button className="button primary small" onClick={handleApply} disabled={loading}>
      {loading ? "Applying..." : "Use Template"}
    </button>
  );
}
