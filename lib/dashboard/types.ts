import type { NavGroup, NavRole } from "@/lib/navigation/types";

export type DashboardRole = NavRole;

export type DashboardQueueStatus = "healthy" | "needs_action" | "overdue";

export interface DashboardModule {
  href: string;
  label: string;
  icon: string;
  group: NavGroup;
  description: string;
  priority: number;
  badgeKey?: string;
}

export interface DashboardSection {
  id: string;
  title: string;
  modules: DashboardModule[];
}

export interface DashboardKpi {
  id: string;
  label: string;
  value: number | string;
  note?: string;
}

export interface DashboardQueueCard {
  id: string;
  title: string;
  description: string;
  count: number;
  href: string;
  status: DashboardQueueStatus;
  badgeKey?: string;
}

export interface DashboardNextAction {
  id: string;
  title: string;
  detail: string;
  href: string;
}

export interface ActivePathwaySummary {
  id: string;
  name: string;
  interestArea: string;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  nextStepTitle: string | null;
}

export interface InstructorReadinessSummary {
  trainingComplete: boolean;
  completedRequiredModules: number;
  requiredModulesCount: number;
  trainingPercent: number;
  interviewStatus: string;
  interviewPassed: boolean;
  approvedLevels: string[];
  highestApprovedLevel: string | null;
  missingRequirementsCount: number;
  canPublishFirstOffering: boolean;
  featureEnabled: boolean;
}

export interface DashboardData {
  role: DashboardRole;
  roleLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  kpis: DashboardKpi[];
  queues: DashboardQueueCard[];
  sections: DashboardSection[];
  nextActions: DashboardNextAction[];
  moduleBadgeByHref: Record<string, number>;
  generatedAt: string;
  activePathways?: ActivePathwaySummary[];
  instructorReadiness?: InstructorReadinessSummary;
}
