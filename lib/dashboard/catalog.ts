import { resolveNavModel } from "@/lib/navigation/resolve-nav";
import type { NavLink } from "@/lib/navigation/types";
import type { DashboardModule, DashboardRole, DashboardSection } from "@/lib/dashboard/types";

function toDashboardModule(link: NavLink): DashboardModule {
  return {
    href: link.href,
    label: link.label,
    icon: link.icon,
    group: link.group,
    description: link.dashboardDescription ?? `Open ${link.label.toLowerCase()}.`,
    priority: link.dashboardPriority ?? link.priority,
    badgeKey: link.dashboardBadgeKey,
  };
}

function groupModules(modules: DashboardModule[]): DashboardSection[] {
  const grouped = new Map<string, DashboardModule[]>();
  for (const module of modules) {
    const existing = grouped.get(module.group);
    if (existing) {
      existing.push(module);
    } else {
      grouped.set(module.group, [module]);
    }
  }

  return Array.from(grouped.entries()).map(([group, items]) => ({
    id: group.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: group,
    modules: [...items].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.label.localeCompare(b.label);
    }),
  }));
}

export function getDashboardModulesForRole(role: DashboardRole, options?: { hasAward?: boolean }) {
  const nav = resolveNavModel({
    roles: [role],
    primaryRole: role,
    pathname: "/",
  });

  const hasAward = options?.hasAward ?? false;

  const visible = nav.visible.filter((link) => {
    if (link.href === "/") return false;
    if (link.requiresAward && !hasAward && role !== "ADMIN") return false;
    return true;
  });

  const modules = visible.map(toDashboardModule);
  const sections = groupModules(modules);

  return {
    modules,
    sections,
  };
}
