-- Hot-path foreign-key indexes (Data 360 pass).
--
-- Postgres does not auto-index FK columns. The newest modules (ActionItem,
-- ClassOffering, Meeting, Partner, WeeklyImpact*) are thoroughly indexed, but
-- the oldest models still scan on their hottest lookups: chapter rosters
-- (User.chapterId), mentor/mentee dashboards (Mentorship.mentorId/menteeId),
-- per-applicant history (InstructorApplication.applicantId,
-- Application.applicantId), and the legacy Course/Enrollment joins.
--
-- Additive only: CREATE INDEX IF NOT EXISTS throughout; no table or column
-- changes. Index names match Prisma's default naming so `prisma migrate diff`
-- stays clean.

CREATE INDEX IF NOT EXISTS "User_chapterId_idx" ON "User"("chapterId");

CREATE INDEX IF NOT EXISTS "Mentorship_mentorId_idx" ON "Mentorship"("mentorId");
CREATE INDEX IF NOT EXISTS "Mentorship_menteeId_idx" ON "Mentorship"("menteeId");

CREATE INDEX IF NOT EXISTS "InstructorApplication_applicantId_idx" ON "InstructorApplication"("applicantId");

CREATE INDEX IF NOT EXISTS "Application_applicantId_idx" ON "Application"("applicantId");

CREATE INDEX IF NOT EXISTS "Course_chapterId_idx" ON "Course"("chapterId");
CREATE INDEX IF NOT EXISTS "Course_leadInstructorId_idx" ON "Course"("leadInstructorId");

CREATE INDEX IF NOT EXISTS "Enrollment_userId_idx" ON "Enrollment"("userId");
CREATE INDEX IF NOT EXISTS "Enrollment_courseId_idx" ON "Enrollment"("courseId");
