-- This migration contains no SQL changes.
-- It corresponds to adding /// DEPRECATED doc comments on legacy mentorship
-- models in schema.prisma (GoalTemplate, Goal, ProgressUpdate, ReflectionForm,
-- ReflectionQuestion, ReflectionSubmission, ReflectionResponse,
-- MonthlyGoalReview, MonthlyGoalRating, AchievementPointLedger,
-- MentorshipAwardRecommendation). Comments are schema documentation only and
-- produce no DDL. The modern equivalents are MentorshipProgramGoal,
-- MonthlySelfReflection, MentorGoalReview, GoalReviewRating, and
-- AchievementPointLog. Migration from legacy → modern happens in Phase 1.
SELECT 1;
