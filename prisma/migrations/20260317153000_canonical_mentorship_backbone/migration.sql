CREATE TYPE "MentorshipProgramGroup" AS ENUM ('OFFICER', 'INSTRUCTOR', 'STUDENT');
CREATE TYPE "MentorshipGovernanceMode" AS ENUM ('FULL_PROGRAM', 'CONNECTED_STUDENT');
CREATE TYPE "MentorshipCommitteeScope" AS ENUM ('GLOBAL', 'CHAPTER');
CREATE TYPE "MentorshipAwardPolicy" AS ENUM ('ACHIEVEMENT_LADDER', 'STUDENT_RECOGNITION');

ALTER TABLE "Mentorship"
  ADD COLUMN "programGroup" "MentorshipProgramGroup" NOT NULL DEFAULT 'INSTRUCTOR',
  ADD COLUMN "governanceMode" "MentorshipGovernanceMode" NOT NULL DEFAULT 'FULL_PROGRAM';

ALTER TABLE "GoalTemplate"
  ADD COLUMN "mentorshipProgramGroup" "MentorshipProgramGroup";

ALTER TABLE "ReflectionForm"
  ADD COLUMN "mentorshipProgramGroup" "MentorshipProgramGroup";

ALTER TABLE "MentorshipTrack"
  ADD COLUMN "chapterId" TEXT,
  ADD COLUMN "programGroup" "MentorshipProgramGroup" NOT NULL DEFAULT 'INSTRUCTOR',
  ADD COLUMN "governanceMode" "MentorshipGovernanceMode" NOT NULL DEFAULT 'FULL_PROGRAM',
  ADD COLUMN "committeeScope" "MentorshipCommitteeScope" NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN "mentorCap" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "awardPolicy" "MentorshipAwardPolicy" NOT NULL DEFAULT 'ACHIEVEMENT_LADDER',
  ADD COLUMN "requiresQuarterlyReview" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MonthlyGoalReview"
  ADD COLUMN "requiresChairApproval" BOOLEAN NOT NULL DEFAULT true;

UPDATE "MentorshipTrack"
SET
  "programGroup" = CASE
    WHEN "pointCategory" = 'STUDENT' THEN 'STUDENT'::"MentorshipProgramGroup"
    WHEN "pointCategory" = 'INSTRUCTOR' THEN 'INSTRUCTOR'::"MentorshipProgramGroup"
    ELSE 'OFFICER'::"MentorshipProgramGroup"
  END,
  "governanceMode" = CASE
    WHEN "pointCategory" = 'STUDENT' THEN 'CONNECTED_STUDENT'::"MentorshipGovernanceMode"
    ELSE 'FULL_PROGRAM'::"MentorshipGovernanceMode"
  END,
  "committeeScope" = CASE
    WHEN "pointCategory" = 'INSTRUCTOR' OR "scope" = 'CHAPTER' THEN 'CHAPTER'::"MentorshipCommitteeScope"
    ELSE 'GLOBAL'::"MentorshipCommitteeScope"
  END,
  "mentorCap" = CASE
    WHEN "pointCategory" = 'STUDENT' THEN 6
    ELSE 3
  END,
  "awardPolicy" = CASE
    WHEN "pointCategory" = 'STUDENT' THEN 'STUDENT_RECOGNITION'::"MentorshipAwardPolicy"
    ELSE 'ACHIEVEMENT_LADDER'::"MentorshipAwardPolicy"
  END,
  "requiresQuarterlyReview" = CASE
    WHEN "pointCategory" = 'STUDENT' THEN false
    ELSE true
  END;

WITH "track_chapters" AS (
  SELECT
    m."trackId" AS "trackId",
    MIN(u."chapterId") AS "chapterId",
    COUNT(DISTINCT u."chapterId") FILTER (WHERE u."chapterId" IS NOT NULL) AS "chapterCount"
  FROM "Mentorship" m
  JOIN "User" u ON u."id" = m."menteeId"
  WHERE m."trackId" IS NOT NULL
  GROUP BY m."trackId"
)
UPDATE "MentorshipTrack" t
SET "chapterId" = tc."chapterId"
FROM "track_chapters" tc
WHERE t."id" = tc."trackId"
  AND tc."chapterCount" = 1;

UPDATE "Mentorship" m
SET
  "programGroup" = CASE
    WHEN m."type" = 'STUDENT' OR u."primaryRole" = 'STUDENT' THEN 'STUDENT'::"MentorshipProgramGroup"
    WHEN u."primaryRole" = 'INSTRUCTOR' THEN 'INSTRUCTOR'::"MentorshipProgramGroup"
    ELSE 'OFFICER'::"MentorshipProgramGroup"
  END,
  "governanceMode" = CASE
    WHEN m."type" = 'STUDENT' OR u."primaryRole" = 'STUDENT' THEN 'CONNECTED_STUDENT'::"MentorshipGovernanceMode"
    ELSE 'FULL_PROGRAM'::"MentorshipGovernanceMode"
  END
FROM "User" u
WHERE u."id" = m."menteeId";

UPDATE "GoalTemplate"
SET "mentorshipProgramGroup" = CASE
  WHEN "roleType" = 'STUDENT' THEN 'STUDENT'::"MentorshipProgramGroup"
  WHEN "roleType" = 'INSTRUCTOR' THEN 'INSTRUCTOR'::"MentorshipProgramGroup"
  ELSE 'OFFICER'::"MentorshipProgramGroup"
END;

UPDATE "ReflectionForm"
SET "mentorshipProgramGroup" = CASE
  WHEN "roleType" = 'STUDENT' THEN 'STUDENT'::"MentorshipProgramGroup"
  WHEN "roleType" = 'INSTRUCTOR' THEN 'INSTRUCTOR'::"MentorshipProgramGroup"
  ELSE 'OFFICER'::"MentorshipProgramGroup"
END;

UPDATE "MonthlyGoalReview" review
SET "requiresChairApproval" = CASE
  WHEN mentorship."programGroup" = 'STUDENT' THEN false
  ELSE true
END
FROM "Mentorship" mentorship
WHERE mentorship."id" = review."mentorshipId";

ALTER TABLE "MentorshipTrack"
  ADD CONSTRAINT "MentorshipTrack_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MentorshipTrack_chapterId_idx" ON "MentorshipTrack"("chapterId");
CREATE INDEX "MentorshipTrack_programGroup_governanceMode_idx" ON "MentorshipTrack"("programGroup", "governanceMode");
