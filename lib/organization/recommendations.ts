// The recommendation engine. Deterministic, no AI: every suggestion is a pure
// function of the graph and carries the concrete evidence behind it, so a human
// can verify (and override) it. Derived entirely from already-computed node
// health, metrics, dependencies, and structure — no new data.

import type { OrganizationGraph, OrgNode, Recommendation } from "@/lib/organization/types";
import { childrenOf, incomingEdges, parentsOf } from "@/lib/organization/query";

function metricValue(node: OrgNode, label: string): string | number | undefined {
  return node.metrics.find((m) => m.label === label)?.value;
}

function classChildren(graph: OrganizationGraph, id: string): OrgNode[] {
  return childrenOf(graph, id).filter((n) => n.kind === "class");
}

function isHealthy(n: OrgNode): boolean {
  return n.health.tone === "success";
}
function isDanger(n: OrgNode): boolean {
  return n.health.tone === "danger";
}

/** Classes with no instructor (no incoming TEACHES edge). */
function unstaffedClasses(graph: OrganizationGraph): OrgNode[] {
  return graph.nodes.filter(
    (n) => n.kind === "class" && !incomingEdges(graph, n.id).some((e) => e.kind === "TEACHES")
  );
}

const KIND_RANK: Record<Recommendation["kind"], number> = {
  intervention: 0,
  retention: 1,
  next_step: 2,
  assignment: 3,
  expansion: 4,
  recognition: 5,
};

function finalize(recs: Recommendation[]): Recommendation[] {
  return recs
    .map((r) => (r.evidence.length ? r : { ...r, evidence: ["Based on current operating data"] }))
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.key.localeCompare(b.key));
}

/** Deterministic, evidence-backed recommendations for one node. */
export function recommendForNode(graph: OrganizationGraph, id: string): Recommendation[] {
  const node = graph.nodeIndex.get(id);
  if (!node) return [];
  const deps = graph.dependencies.get(id) ?? [];
  const blockedBy = deps.filter((d) => d.blocking && d.state === "blocked");
  const recs: Recommendation[] = [];

  switch (node.kind) {
    case "partner": {
      const classes = classChildren(graph, id);
      const healthy = classes.filter(isHealthy);
      const students = metricValue(node, "Students") ?? 0;
      if (classes.length >= 2 && healthy.length === classes.length) {
        recs.push({
          key: "partner-expand",
          kind: "expansion",
          title: "Ready for expansion",
          detail: "Every class here is healthy — a strong candidate for an additional class or cohort.",
          evidence: [`${classes.length} classes, all healthy`, `${students} students served`],
          confidence: "high",
        });
      }
      if (blockedBy.length > 0) {
        recs.push({
          key: "partner-resolve",
          kind: "intervention",
          title: "Resolve the open issue",
          detail: blockedBy[0].label,
          evidence: blockedBy.map((b) => b.label),
          confidence: "high",
          href: blockedBy[0].href,
        });
      }
      break;
    }

    case "instructor": {
      const classes = classChildren(graph, id);
      const count = Number(metricValue(node, "Classes") ?? classes.length);
      if (isDanger(node)) {
        recs.push({
          key: "instructor-support",
          kind: "intervention",
          title: "Check in with this instructor",
          detail: "One or more of their classes needs support.",
          evidence: node.health.reasons,
          confidence: "high",
          href: node.href,
        });
      }
      if (count >= 4) {
        recs.push({
          key: "instructor-load",
          kind: "intervention",
          title: "Heavy teaching load",
          detail: "Consider redistributing before adding more.",
          evidence: [`Teaching ${count} classes`],
          confidence: "medium",
        });
      } else if (count <= 1) {
        const open = unstaffedClasses(graph);
        if (open.length > 0) {
          recs.push({
            key: "instructor-available",
            kind: "assignment",
            title: "Available to take on a class",
            detail: `Light teaching load with ${open.length} class${open.length === 1 ? "" : "es"} still needing an instructor.`,
            evidence: [`Currently teaching ${count} class${count === 1 ? "" : "es"}`, `${open.length} unstaffed class${open.length === 1 ? "" : "es"}`],
            confidence: "medium",
            relatedNodeId: open[0].id,
            href: open[0].href,
          });
        }
      }
      if (recs.length === 0 && classes.length > 0 && classes.every(isHealthy)) {
        recs.push({
          key: "instructor-recognize",
          kind: "recognition",
          title: "Consistently strong teaching",
          detail: "All of their classes are healthy — worth recognizing.",
          evidence: [`${classes.length} healthy class${classes.length === 1 ? "" : "es"}`],
          confidence: "medium",
        });
      }
      break;
    }

    case "curriculum": {
      const classes = classChildren(graph, id);
      if (node.status === "Approved" || node.health.label === "Approved") {
        if (classes.length >= 1 && classes.every(isHealthy)) {
          recs.push({
            key: "curriculum-reuse",
            kind: "recognition",
            title: "This curriculum is succeeding",
            detail: "Classes using it are healthy — a good template to reuse for new classes.",
            evidence: [`Powers ${classes.length} class${classes.length === 1 ? "" : "es"}, all healthy`],
            confidence: "high",
          });
        }
      } else if (classes.length > 0) {
        recs.push({
          key: "curriculum-approve",
          kind: "next_step",
          title: `Approve to unblock ${classes.length} class${classes.length === 1 ? "" : "es"}`,
          detail: "Classes powered by this curriculum can't launch until it's fully approved.",
          evidence: [`${classes.length} class${classes.length === 1 ? "" : "es"} depend on it`, node.status ?? "Not approved"],
          confidence: "high",
          href: node.href,
        });
      }
      break;
    }

    case "class": {
      if (blockedBy.length > 0) {
        recs.push({
          key: "class-next",
          kind: "next_step",
          title: blockedBy[0].label,
          detail: blockedBy[0].detail ?? "Resolve this to move the class forward.",
          evidence: blockedBy.map((b) => b.label),
          confidence: "high",
          href: blockedBy[0].href ?? node.href,
        });
      } else if (isDanger(node)) {
        recs.push({
          key: "class-intervene",
          kind: "intervention",
          title: "Intervene on this class",
          detail: "Health signals are in the danger zone.",
          evidence: node.health.reasons,
          confidence: "high",
          href: node.href,
        });
      } else if ((node.sublabel === "Completed" || node.sublabel === "Renewal Candidate") && isHealthy(node)) {
        recs.push({
          key: "class-renew",
          kind: "expansion",
          title: "Strong renewal candidate",
          detail: "Finished healthy — worth running again next term.",
          evidence: node.health.reasons,
          confidence: "high",
          href: node.href,
        });
      }
      break;
    }

    case "student": {
      if (isDanger(node)) {
        recs.push({
          key: "student-reengage",
          kind: "retention",
          title: "Re-engage this student",
          detail: blockedBy[0]?.label ?? "Attendance or engagement signals are low.",
          evidence: node.health.reasons,
          confidence: "high",
          href: node.href,
        });
      }
      const enrolledClasses = parentsOf(graph, id).filter((n) => n.kind === "class");
      const completed = enrolledClasses.some((c) => c.sublabel === "Completed");
      if (completed) {
        // Suggest a sibling class the student isn't already in.
        const enrolledIds = new Set(enrolledClasses.map((c) => c.id));
        const next = graph.nodes.find((n) => n.kind === "class" && !enrolledIds.has(n.id) && isHealthy(n));
        if (next) {
          recs.push({
            key: "student-next",
            kind: "next_step",
            title: "Recommend a next class",
            detail: `Completed a class — ${next.label} is a healthy next opportunity.`,
            evidence: ["Completed at least one class", `${next.label} is healthy and enrolling`],
            confidence: "medium",
            relatedNodeId: next.id,
            href: next.href,
          });
        }
      }
      break;
    }

    case "chapter": {
      if (blockedBy.length > 0) {
        recs.push({
          key: "chapter-top-blocker",
          kind: "next_step",
          title: "Clear the top blocker",
          detail: blockedBy[0].label,
          evidence: blockedBy.slice(0, 3).map((b) => b.label),
          confidence: "high",
          href: blockedBy[0].href,
        });
      }
      break;
    }

    case "family":
      break;
  }

  return finalize(recs);
}

/** Chapter-wide recommendations: the most useful move per high-value node. */
export function recommendAcrossChapter(graph: OrganizationGraph): Array<{ node: OrgNode; recommendation: Recommendation }> {
  const out: Array<{ node: OrgNode; recommendation: Recommendation }> = [];
  for (const node of graph.nodes) {
    const [top] = recommendForNode(graph, node.id);
    if (top) out.push({ node, recommendation: top });
  }
  return out.sort(
    (a, b) => KIND_RANK[a.recommendation.kind] - KIND_RANK[b.recommendation.kind] || a.node.id.localeCompare(b.node.id)
  );
}
