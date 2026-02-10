import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPortfolioTemplates } from "@/lib/real-world-actions";
import Link from "next/link";
import { ApplyTemplateButton } from "./client";

export default async function PortfolioTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const templates = await getPortfolioTemplates();

  const layoutIcons: Record<string, string> = {
    grid: "Grid",
    timeline: "Timeline",
    showcase: "Showcase",
    minimal: "Minimal",
  };

  const colorPreviews: Record<string, string> = {
    default: "#7c3aed",
    dark: "#1f2937",
    warm: "#ea580c",
    cool: "#0891b2",
    vibrant: "#ec4899",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/portfolio" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; My Portfolio
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Portfolio Templates</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Choose a template to jumpstart your portfolio. Each comes with pre-built sections tailored to your passion.
          </p>
        </div>
      </div>

      {/* Template categories */}
      <div className="card" style={{ marginBottom: 24, background: "var(--ypp-purple-50)", borderLeft: "4px solid var(--ypp-purple)" }}>
        <div style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>How Templates Work</div>
        <p style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
          Templates set up your portfolio with the right sections, layout, and color scheme for your passion.
          You can always customize everything after applying a template. Your existing content stays safe.
        </p>
      </div>

      {templates.length > 0 ? (
        <div className="grid two">
          {templates.map((template) => {
            const sections = Array.isArray(template.sections) ? template.sections as { title: string; type: string }[] : [];
            const tips = Array.isArray(template.tips) ? template.tips as string[] : [];

            return (
              <div key={template.id} className="card" style={{ borderTop: `4px solid ${colorPreviews[template.colorScheme] || "#7c3aed"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{template.name}</h3>
                    {template.passionArea && (
                      <span className="pill" style={{ fontSize: 11, marginTop: 4 }}>
                        {template.passionArea}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="pill" style={{ fontSize: 10, background: "var(--surface-alt)" }}>
                      {layoutIcons[template.layout] || template.layout}
                    </span>
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: colorPreviews[template.colorScheme] || "#7c3aed",
                    }} />
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0" }}>
                  {template.description}
                </p>

                {/* Pre-built sections */}
                {sections.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                      Includes sections:
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {sections.map((s, i) => (
                        <span key={i} className="pill" style={{ fontSize: 10 }}>
                          {s.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips preview */}
                {tips.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                    Tip: {tips[0]}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    Used {template.usageCount} times
                  </span>
                  <ApplyTemplateButton templateId={template.id} templateName={template.name} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <h3>No Templates Yet</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            Portfolio templates will appear here soon. In the meantime, you can build your portfolio from scratch.
          </p>
          <Link href="/portfolio" className="button primary" style={{ marginTop: 12 }}>
            Go to Portfolio Builder
          </Link>
        </div>
      )}
    </div>
  );
}
