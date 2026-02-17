export type ActivitySourceType =
  | "PORTAL_CHALLENGE"
  | "TALENT_CHALLENGE"
  | "TRY_IT_SESSION"
  | "INCUBATOR_PROJECT"
  | "PROJECT_TRACKER";

export type ActivityLifecycle =
  | "DRAFT"
  | "ACTIVE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export type ActivityAudience =
  | "STUDENT"
  | "PARENT"
  | "MENTOR"
  | "INSTRUCTOR"
  | "CHAPTER_LEAD"
  | "ADMIN"
  | "STAFF";

export type ActivityItem = {
  id: string;
  sourceType: ActivitySourceType;
  passionId: string | null;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "ADVANCED";
  status: ActivityLifecycle;
  xp: number;
  durationMinutes: number | null;
  links: {
    primary: string;
    secondary?: string;
  };
  audience: ActivityAudience[];
  tags: string[];
  updatedAt: Date;
  metadata?: Record<string, unknown>;
};

export type ActivityFeedFilters = {
  passionId?: string;
  sourceTypes?: ActivitySourceType[];
  includeDraft?: boolean;
  limit?: number;
};

export type ActivityFeedResult = {
  items: ActivityItem[];
  countsBySource: Record<ActivitySourceType, number>;
};
