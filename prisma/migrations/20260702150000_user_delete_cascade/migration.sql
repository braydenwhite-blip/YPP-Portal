-- Make User rows deletable: declare onDelete on every FK referencing User.
-- Required (NOT NULL) refs -> CASCADE; optional (nullable) refs -> SET NULL.
-- Idempotent: each constraint is dropped-if-exists then re-added.

-- ---------------------------------------------------------------------------
-- Schema-drift reconciliation (must run BEFORE the FK statements below).
--
-- ClassTemplate and SeasonalCompetition are baselined-from-Supabase tables:
-- their review-workflow columns were added to prisma/schema.prisma but no
-- migration ever added them to the database. The reviewedById FK statements
-- further down (and the generated Prisma Client) reference columns Postgres
-- does not have, which is what produced:
--   ERROR 42703: column "reviewedById" referenced in foreign key constraint
--   does not exist
-- Add the missing columns first so the FKs can be created. IF NOT EXISTS makes
-- every statement a no-op where the column is already present (additive only,
-- no data loss). The "CurriculumSubmissionStatus" enum already exists (created
-- in 20260313120000_align_instructor_builder_schema).
ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "submissionStatus" "CurriculumSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;

ALTER TABLE "SeasonalCompetition"
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;
-- ---------------------------------------------------------------------------

ALTER TABLE "ChapterSupportRequest" DROP CONSTRAINT IF EXISTS "ChapterSupportRequest_requestedById_fkey";
ALTER TABLE "ChapterSupportRequest" ADD CONSTRAINT "ChapterSupportRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterNote" DROP CONSTRAINT IF EXISTS "ChapterNote_authorId_fkey";
ALTER TABLE "ChapterNote" ADD CONSTRAINT "ChapterNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_referredById_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserRole" DROP CONSTRAINT IF EXISTS "UserRole_userId_fkey";
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserProfile" DROP CONSTRAINT IF EXISTS "UserProfile_userId_fkey";
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Course" DROP CONSTRAINT IF EXISTS "Course_leadInstructorId_fkey";
ALTER TABLE "Course" ADD CONSTRAINT "Course_leadInstructorId_fkey" FOREIGN KEY ("leadInstructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pathway" DROP CONSTRAINT IF EXISTS "Pathway_createdById_fkey";
ALTER TABLE "Pathway" ADD CONSTRAINT "Pathway_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PathwayStepUnlock" DROP CONSTRAINT IF EXISTS "PathwayStepUnlock_userId_fkey";
ALTER TABLE "PathwayStepUnlock" ADD CONSTRAINT "PathwayStepUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_userId_fkey";
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingAssignment" DROP CONSTRAINT IF EXISTS "TrainingAssignment_userId_fkey";
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoProgress" DROP CONSTRAINT IF EXISTS "VideoProgress_userId_fkey";
ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApproval" DROP CONSTRAINT IF EXISTS "InstructorApproval_instructorId_fkey";
ALTER TABLE "InstructorApproval" ADD CONSTRAINT "InstructorApproval_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApplication" DROP CONSTRAINT IF EXISTS "InstructorApplication_applicantId_fkey";
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApplication" DROP CONSTRAINT IF EXISTS "InstructorApplication_reviewerId_fkey";
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorApplication" DROP CONSTRAINT IF EXISTS "InstructorApplication_reviewerAssignedById_fkey";
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_reviewerAssignedById_fkey" FOREIGN KEY ("reviewerAssignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorApplication" DROP CONSTRAINT IF EXISTS "InstructorApplication_subtypeChangedById_fkey";
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_subtypeChangedById_fkey" FOREIGN KEY ("subtypeChangedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorApplication" DROP CONSTRAINT IF EXISTS "InstructorApplication_importedById_fkey";
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationReview" DROP CONSTRAINT IF EXISTS "InstructorApplicationReview_editedById_fkey";
ALTER TABLE "InstructorApplicationReview" ADD CONSTRAINT "InstructorApplicationReview_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationReviewRevision" DROP CONSTRAINT IF EXISTS "InstructorApplicationReviewRevision_editedById_fkey";
ALTER TABLE "InstructorApplicationReviewRevision" ADD CONSTRAINT "InstructorApplicationReviewRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationInterviewer" DROP CONSTRAINT IF EXISTS "InstructorApplicationInterviewer_interviewerId_fkey";
ALTER TABLE "InstructorApplicationInterviewer" ADD CONSTRAINT "InstructorApplicationInterviewer_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationInterviewer" DROP CONSTRAINT IF EXISTS "InstructorApplicationInterviewer_assignedById_fkey";
ALTER TABLE "InstructorApplicationInterviewer" ADD CONSTRAINT "InstructorApplicationInterviewer_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicantDocument" DROP CONSTRAINT IF EXISTS "ApplicantDocument_uploadedById_fkey";
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationChairDecision" DROP CONSTRAINT IF EXISTS "InstructorApplicationChairDecision_chairId_fkey";
ALTER TABLE "InstructorApplicationChairDecision" ADD CONSTRAINT "InstructorApplicationChairDecision_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationTimelineEvent" DROP CONSTRAINT IF EXISTS "InstructorApplicationTimelineEvent_actorId_fkey";
ALTER TABLE "InstructorApplicationTimelineEvent" ADD CONSTRAINT "InstructorApplicationTimelineEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActiveChairAssignment" DROP CONSTRAINT IF EXISTS "ActiveChairAssignment_chairUserId_fkey";
ALTER TABLE "ActiveChairAssignment" ADD CONSTRAINT "ActiveChairAssignment_chairUserId_fkey" FOREIGN KEY ("chairUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActiveChairAssignment" DROP CONSTRAINT IF EXISTS "ActiveChairAssignment_assignedById_fkey";
ALTER TABLE "ActiveChairAssignment" ADD CONSTRAINT "ActiveChairAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChairAssignmentHistory" DROP CONSTRAINT IF EXISTS "ChairAssignmentHistory_previousChairId_fkey";
ALTER TABLE "ChairAssignmentHistory" ADD CONSTRAINT "ChairAssignmentHistory_previousChairId_fkey" FOREIGN KEY ("previousChairId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChairAssignmentHistory" DROP CONSTRAINT IF EXISTS "ChairAssignmentHistory_newChairId_fkey";
ALTER TABLE "ChairAssignmentHistory" ADD CONSTRAINT "ChairAssignmentHistory_newChairId_fkey" FOREIGN KEY ("newChairId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChairAssignmentHistory" DROP CONSTRAINT IF EXISTS "ChairAssignmentHistory_changedById_fkey";
ALTER TABLE "ChairAssignmentHistory" ADD CONSTRAINT "ChairAssignmentHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewSignal" DROP CONSTRAINT IF EXISTS "ReviewSignal_pinnedById_fkey";
ALTER TABLE "ReviewSignal" ADD CONSTRAINT "ReviewSignal_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReviewSignal" DROP CONSTRAINT IF EXISTS "ReviewSignal_resolvedById_fkey";
ALTER TABLE "ReviewSignal" ADD CONSTRAINT "ReviewSignal_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainingCheckpointCompletion" DROP CONSTRAINT IF EXISTS "TrainingCheckpointCompletion_userId_fkey";
ALTER TABLE "TrainingCheckpointCompletion" ADD CONSTRAINT "TrainingCheckpointCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingQuizAttempt" DROP CONSTRAINT IF EXISTS "TrainingQuizAttempt_userId_fkey";
ALTER TABLE "TrainingQuizAttempt" ADD CONSTRAINT "TrainingQuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingEvidenceSubmission" DROP CONSTRAINT IF EXISTS "TrainingEvidenceSubmission_userId_fkey";
ALTER TABLE "TrainingEvidenceSubmission" ADD CONSTRAINT "TrainingEvidenceSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingEvidenceSubmission" DROP CONSTRAINT IF EXISTS "TrainingEvidenceSubmission_reviewedById_fkey";
ALTER TABLE "TrainingEvidenceSubmission" ADD CONSTRAINT "TrainingEvidenceSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainingCohort" DROP CONSTRAINT IF EXISTS "TrainingCohort_facilitatorId_fkey";
ALTER TABLE "TrainingCohort" ADD CONSTRAINT "TrainingCohort_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PeerReview" DROP CONSTRAINT IF EXISTS "PeerReview_reviewerId_fkey";
ALTER TABLE "PeerReview" ADD CONSTRAINT "PeerReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscussionThread" DROP CONSTRAINT IF EXISTS "DiscussionThread_authorId_fkey";
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscussionReply" DROP CONSTRAINT IF EXISTS "DiscussionReply_authorId_fkey";
ALTER TABLE "DiscussionReply" ADD CONSTRAINT "DiscussionReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadinessReviewRequest" DROP CONSTRAINT IF EXISTS "ReadinessReviewRequest_instructorId_fkey";
ALTER TABLE "ReadinessReviewRequest" ADD CONSTRAINT "ReadinessReviewRequest_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReadinessReviewRequest" DROP CONSTRAINT IF EXISTS "ReadinessReviewRequest_reviewedById_fkey";
ALTER TABLE "ReadinessReviewRequest" ADD CONSTRAINT "ReadinessReviewRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorTeachingPermission" DROP CONSTRAINT IF EXISTS "InstructorTeachingPermission_instructorId_fkey";
ALTER TABLE "InstructorTeachingPermission" ADD CONSTRAINT "InstructorTeachingPermission_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorTeachingPermission" DROP CONSTRAINT IF EXISTS "InstructorTeachingPermission_grantedById_fkey";
ALTER TABLE "InstructorTeachingPermission" ADD CONSTRAINT "InstructorTeachingPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewGate" DROP CONSTRAINT IF EXISTS "InstructorInterviewGate_instructorId_fkey";
ALTER TABLE "InstructorInterviewGate" ADD CONSTRAINT "InstructorInterviewGate_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewGate" DROP CONSTRAINT IF EXISTS "InstructorInterviewGate_reviewedById_fkey";
ALTER TABLE "InstructorInterviewGate" ADD CONSTRAINT "InstructorInterviewGate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewSlot" DROP CONSTRAINT IF EXISTS "InstructorInterviewSlot_createdById_fkey";
ALTER TABLE "InstructorInterviewSlot" ADD CONSTRAINT "InstructorInterviewSlot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewAvailabilityRequest" DROP CONSTRAINT IF EXISTS "InstructorInterviewAvailabilityRequest_instructorId_fkey";
ALTER TABLE "InstructorInterviewAvailabilityRequest" ADD CONSTRAINT "InstructorInterviewAvailabilityRequest_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewAvailabilityRequest" DROP CONSTRAINT IF EXISTS "InstructorInterviewAvailabilityRequest_reviewedById_fkey";
ALTER TABLE "InstructorInterviewAvailabilityRequest" ADD CONSTRAINT "InstructorInterviewAvailabilityRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Mentorship" DROP CONSTRAINT IF EXISTS "Mentorship_mentorId_fkey";
ALTER TABLE "Mentorship" ADD CONSTRAINT "Mentorship_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mentorship" DROP CONSTRAINT IF EXISTS "Mentorship_menteeId_fkey";
ALTER TABLE "Mentorship" ADD CONSTRAINT "Mentorship_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mentorship" DROP CONSTRAINT IF EXISTS "Mentorship_chairId_fkey";
ALTER TABLE "Mentorship" ADD CONSTRAINT "Mentorship_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventRsvp" DROP CONSTRAINT IF EXISTS "EventRsvp_userId_fkey";
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_instructorId_fkey";
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_authorId_fkey";
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Award" DROP CONSTRAINT IF EXISTS "Award_recipientId_fkey";
ALTER TABLE "Award" ADD CONSTRAINT "Award_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Position" DROP CONSTRAINT IF EXISTS "Position_openedById_fkey";
ALTER TABLE "Position" ADD CONSTRAINT "Position_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Position" DROP CONSTRAINT IF EXISTS "Position_hiringLeadId_fkey";
ALTER TABLE "Position" ADD CONSTRAINT "Position_hiringLeadId_fkey" FOREIGN KEY ("hiringLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Application" DROP CONSTRAINT IF EXISTS "Application_applicantId_fkey";
ALTER TABLE "Application" ADD CONSTRAINT "Application_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Application" DROP CONSTRAINT IF EXISTS "Application_importedById_fkey";
ALTER TABLE "Application" ADD CONSTRAINT "Application_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewSlot" DROP CONSTRAINT IF EXISTS "InterviewSlot_interviewerId_fkey";
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewNote" DROP CONSTRAINT IF EXISTS "InterviewNote_authorId_fkey";
ALTER TABLE "InterviewNote" ADD CONSTRAINT "InterviewNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Decision" DROP CONSTRAINT IF EXISTS "Decision_decidedById_fkey";
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Decision" DROP CONSTRAINT IF EXISTS "Decision_hiringChairId_fkey";
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_hiringChairId_fkey" FOREIGN KEY ("hiringChairId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Announcement" DROP CONSTRAINT IF EXISTS "Announcement_authorId_fkey";
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Goal" DROP CONSTRAINT IF EXISTS "Goal_userId_fkey";
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressUpdate" DROP CONSTRAINT IF EXISTS "ProgressUpdate_submittedById_fkey";
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressUpdate" DROP CONSTRAINT IF EXISTS "ProgressUpdate_forUserId_fkey";
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_forUserId_fkey" FOREIGN KEY ("forUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReflectionSubmission" DROP CONSTRAINT IF EXISTS "ReflectionSubmission_userId_fkey";
ALTER TABLE "ReflectionSubmission" ADD CONSTRAINT "ReflectionSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorCommittee" DROP CONSTRAINT IF EXISTS "MentorCommittee_chairUserId_fkey";
ALTER TABLE "MentorCommittee" ADD CONSTRAINT "MentorCommittee_chairUserId_fkey" FOREIGN KEY ("chairUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MentorCommitteeMember" DROP CONSTRAINT IF EXISTS "MentorCommitteeMember_userId_fkey";
ALTER TABLE "MentorCommitteeMember" ADD CONSTRAINT "MentorCommitteeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyGoalReview" DROP CONSTRAINT IF EXISTS "MonthlyGoalReview_menteeId_fkey";
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyGoalReview" DROP CONSTRAINT IF EXISTS "MonthlyGoalReview_mentorId_fkey";
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlyGoalReview" DROP CONSTRAINT IF EXISTS "MonthlyGoalReview_chairId_fkey";
ALTER TABLE "MonthlyGoalReview" ADD CONSTRAINT "MonthlyGoalReview_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AchievementPointLedger" DROP CONSTRAINT IF EXISTS "AchievementPointLedger_userId_fkey";
ALTER TABLE "AchievementPointLedger" ADD CONSTRAINT "AchievementPointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AchievementPointLedger" DROP CONSTRAINT IF EXISTS "AchievementPointLedger_approvedById_fkey";
ALTER TABLE "AchievementPointLedger" ADD CONSTRAINT "AchievementPointLedger_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuarterlyCommitteeReview" DROP CONSTRAINT IF EXISTS "QuarterlyCommitteeReview_menteeId_fkey";
ALTER TABLE "QuarterlyCommitteeReview" ADD CONSTRAINT "QuarterlyCommitteeReview_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuarterlyCommitteeReview" DROP CONSTRAINT IF EXISTS "QuarterlyCommitteeReview_createdById_fkey";
ALTER TABLE "QuarterlyCommitteeReview" ADD CONSTRAINT "QuarterlyCommitteeReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MentorshipAwardRecommendation" DROP CONSTRAINT IF EXISTS "MentorshipAwardRecommendation_userId_fkey";
ALTER TABLE "MentorshipAwardRecommendation" ADD CONSTRAINT "MentorshipAwardRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorshipAwardRecommendation" DROP CONSTRAINT IF EXISTS "MentorshipAwardRecommendation_recommendedById_fkey";
ALTER TABLE "MentorshipAwardRecommendation" ADD CONSTRAINT "MentorshipAwardRecommendation_recommendedById_fkey" FOREIGN KEY ("recommendedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorshipAwardRecommendation" DROP CONSTRAINT IF EXISTS "MentorshipAwardRecommendation_approvedById_fkey";
ALTER TABLE "MentorshipAwardRecommendation" ADD CONSTRAINT "MentorshipAwardRecommendation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionRecommendation" DROP CONSTRAINT IF EXISTS "PromotionRecommendation_userId_fkey";
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionRecommendation" DROP CONSTRAINT IF EXISTS "PromotionRecommendation_recommendedById_fkey";
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_recommendedById_fkey" FOREIGN KEY ("recommendedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionRecommendation" DROP CONSTRAINT IF EXISTS "PromotionRecommendation_approvedById_fkey";
ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SpecialProgram" DROP CONSTRAINT IF EXISTS "SpecialProgram_leaderId_fkey";
ALTER TABLE "SpecialProgram" ADD CONSTRAINT "SpecialProgram_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SpecialProgram" DROP CONSTRAINT IF EXISTS "SpecialProgram_createdById_fkey";
ALTER TABLE "SpecialProgram" ADD CONSTRAINT "SpecialProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SpecialProgram" DROP CONSTRAINT IF EXISTS "SpecialProgram_reviewedById_fkey";
ALTER TABLE "SpecialProgram" ADD CONSTRAINT "SpecialProgram_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SpecialProgramEnrollment" DROP CONSTRAINT IF EXISTS "SpecialProgramEnrollment_userId_fkey";
ALTER TABLE "SpecialProgramEnrollment" ADD CONSTRAINT "SpecialProgramEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniProfile" DROP CONSTRAINT IF EXISTS "AlumniProfile_userId_fkey";
ALTER TABLE "AlumniProfile" ADD CONSTRAINT "AlumniProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollegeAdvisor" DROP CONSTRAINT IF EXISTS "CollegeAdvisor_userId_fkey";
ALTER TABLE "CollegeAdvisor" ADD CONSTRAINT "CollegeAdvisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollegeAdvisorship" DROP CONSTRAINT IF EXISTS "CollegeAdvisorship_adviseeId_fkey";
ALTER TABLE "CollegeAdvisorship" ADD CONSTRAINT "CollegeAdvisorship_adviseeId_fkey" FOREIGN KEY ("adviseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterUpdate" DROP CONSTRAINT IF EXISTS "ChapterUpdate_authorId_fkey";
ALTER TABLE "ChapterUpdate" ADD CONSTRAINT "ChapterUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentStudent" DROP CONSTRAINT IF EXISTS "ParentStudent_parentId_fkey";
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentStudent" DROP CONSTRAINT IF EXISTS "ParentStudent_studentId_fkey";
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_recipientId_fkey";
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT IF EXISTS "AnalyticsEvent_userId_fkey";
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference" DROP CONSTRAINT IF EXISTS "NotificationPreference_userId_fkey";
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant" DROP CONSTRAINT IF EXISTS "ConversationParticipant_userId_fkey";
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_senderId_fkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceSession" DROP CONSTRAINT IF EXISTS "AttendanceSession_createdById_fkey";
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_userId_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnboardingProgress" DROP CONSTRAINT IF EXISTS "OnboardingProgress_userId_fkey";
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "XpTransaction" DROP CONSTRAINT IF EXISTS "XpTransaction_userId_fkey";
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Resource" DROP CONSTRAINT IF EXISTS "Resource_uploadedById_fkey";
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileUpload" DROP CONSTRAINT IF EXISTS "FileUpload_userId_fkey";
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonPlan" DROP CONSTRAINT IF EXISTS "LessonPlan_authorId_fkey";
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WaitlistEntry" DROP CONSTRAINT IF EXISTS "WaitlistEntry_userId_fkey";
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudyGroup" DROP CONSTRAINT IF EXISTS "StudyGroup_createdById_fkey";
ALTER TABLE "StudyGroup" ADD CONSTRAINT "StudyGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudyGroupMember" DROP CONSTRAINT IF EXISTS "StudyGroupMember_userId_fkey";
ALTER TABLE "StudyGroupMember" ADD CONSTRAINT "StudyGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudyGroupMessage" DROP CONSTRAINT IF EXISTS "StudyGroupMessage_userId_fkey";
ALTER TABLE "StudyGroupMessage" ADD CONSTRAINT "StudyGroupMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudyGroupResource" DROP CONSTRAINT IF EXISTS "StudyGroupResource_uploadedById_fkey";
ALTER TABLE "StudyGroupResource" ADD CONSTRAINT "StudyGroupResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningNote" DROP CONSTRAINT IF EXISTS "LearningNote_userId_fkey";
ALTER TABLE "LearningNote" ADD CONSTRAINT "LearningNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment" DROP CONSTRAINT IF EXISTS "Assignment_createdById_fkey";
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentSubmission" DROP CONSTRAINT IF EXISTS "AssignmentSubmission_studentId_fkey";
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentSubmission" DROP CONSTRAINT IF EXISTS "AssignmentSubmission_gradedById_fkey";
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SkillBadge" DROP CONSTRAINT IF EXISTS "SkillBadge_userId_fkey";
ALTER TABLE "SkillBadge" ADD CONSTRAINT "SkillBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseReview" DROP CONSTRAINT IF EXISTS "CourseReview_userId_fkey";
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniQuestion" DROP CONSTRAINT IF EXISTS "AlumniQuestion_studentId_fkey";
ALTER TABLE "AlumniQuestion" ADD CONSTRAINT "AlumniQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniQuestion" DROP CONSTRAINT IF EXISTS "AlumniQuestion_advisorId_fkey";
ALTER TABLE "AlumniQuestion" ADD CONSTRAINT "AlumniQuestion_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomGoal" DROP CONSTRAINT IF EXISTS "CustomGoal_userId_fkey";
ALTER TABLE "CustomGoal" ADD CONSTRAINT "CustomGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeerRecognition" DROP CONSTRAINT IF EXISTS "PeerRecognition_fromUserId_fkey";
ALTER TABLE "PeerRecognition" ADD CONSTRAINT "PeerRecognition_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeerRecognition" DROP CONSTRAINT IF EXISTS "PeerRecognition_toUserId_fkey";
ALTER TABLE "PeerRecognition" ADD CONSTRAINT "PeerRecognition_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Portfolio" DROP CONSTRAINT IF EXISTS "Portfolio_userId_fkey";
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficeHours" DROP CONSTRAINT IF EXISTS "OfficeHours_instructorId_fkey";
ALTER TABLE "OfficeHours" ADD CONSTRAINT "OfficeHours_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficeHoursBooking" DROP CONSTRAINT IF EXISTS "OfficeHoursBooking_studentId_fkey";
ALTER TABLE "OfficeHoursBooking" ADD CONSTRAINT "OfficeHoursBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResourceBookmark" DROP CONSTRAINT IF EXISTS "ResourceBookmark_userId_fkey";
ALTER TABLE "ResourceBookmark" ADD CONSTRAINT "ResourceBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookmarkFolder" DROP CONSTRAINT IF EXISTS "BookmarkFolder_userId_fkey";
ALTER TABLE "BookmarkFolder" ADD CONSTRAINT "BookmarkFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseProposal" DROP CONSTRAINT IF EXISTS "CourseProposal_proposedById_fkey";
ALTER TABLE "CourseProposal" ADD CONSTRAINT "CourseProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseProposal" DROP CONSTRAINT IF EXISTS "CourseProposal_reviewedById_fkey";
ALTER TABLE "CourseProposal" ADD CONSTRAINT "CourseProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompetitionChecklist" DROP CONSTRAINT IF EXISTS "CompetitionChecklist_userId_fkey";
ALTER TABLE "CompetitionChecklist" ADD CONSTRAINT "CompetitionChecklist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseInstructor" DROP CONSTRAINT IF EXISTS "CourseInstructor_instructorId_fkey";
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeerObservation" DROP CONSTRAINT IF EXISTS "PeerObservation_observerId_fkey";
ALTER TABLE "PeerObservation" ADD CONSTRAINT "PeerObservation_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeerObservation" DROP CONSTRAINT IF EXISTS "PeerObservation_observeeId_fkey";
ALTER TABLE "PeerObservation" ADD CONSTRAINT "PeerObservation_observeeId_fkey" FOREIGN KEY ("observeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedbackTemplate" DROP CONSTRAINT IF EXISTS "FeedbackTemplate_instructorId_fkey";
ALTER TABLE "FeedbackTemplate" ADD CONSTRAINT "FeedbackTemplate_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionRecap" DROP CONSTRAINT IF EXISTS "SessionRecap_instructorId_fkey";
ALTER TABLE "SessionRecap" ADD CONSTRAINT "SessionRecap_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubstituteRequest" DROP CONSTRAINT IF EXISTS "SubstituteRequest_requestedById_fkey";
ALTER TABLE "SubstituteRequest" ADD CONSTRAINT "SubstituteRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubstituteRequest" DROP CONSTRAINT IF EXISTS "SubstituteRequest_assignedToId_fkey";
ALTER TABLE "SubstituteRequest" ADD CONSTRAINT "SubstituteRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfessionalDevelopment" DROP CONSTRAINT IF EXISTS "ProfessionalDevelopment_instructorId_fkey";
ALTER TABLE "ProfessionalDevelopment" ADD CONSTRAINT "ProfessionalDevelopment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurriculumFeedback" DROP CONSTRAINT IF EXISTS "CurriculumFeedback_instructorId_fkey";
ALTER TABLE "CurriculumFeedback" ADD CONSTRAINT "CurriculumFeedback_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurriculumFeedback" DROP CONSTRAINT IF EXISTS "CurriculumFeedback_reviewedById_fkey";
ALTER TABLE "CurriculumFeedback" ADD CONSTRAINT "CurriculumFeedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentSpotlight" DROP CONSTRAINT IF EXISTS "StudentSpotlight_studentId_fkey";
ALTER TABLE "StudentSpotlight" ADD CONSTRAINT "StudentSpotlight_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentSpotlight" DROP CONSTRAINT IF EXISTS "StudentSpotlight_nominatedById_fkey";
ALTER TABLE "StudentSpotlight" ADD CONSTRAINT "StudentSpotlight_nominatedById_fkey" FOREIGN KEY ("nominatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentInterest" DROP CONSTRAINT IF EXISTS "StudentInterest_studentId_fkey";
ALTER TABLE "StudentInterest" ADD CONSTRAINT "StudentInterest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PassionQuizResult" DROP CONSTRAINT IF EXISTS "PassionQuizResult_studentId_fkey";
ALTER TABLE "PassionQuizResult" ADD CONSTRAINT "PassionQuizResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentXP" DROP CONSTRAINT IF EXISTS "StudentXP_studentId_fkey";
ALTER TABLE "StudentXP" ADD CONSTRAINT "StudentXP_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "XPTransaction" DROP CONSTRAINT IF EXISTS "XPTransaction_studentId_fkey";
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentBadge" DROP CONSTRAINT IF EXISTS "StudentBadge_studentId_fkey";
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChallengeCompletion" DROP CONSTRAINT IF EXISTS "ChallengeCompletion_studentId_fkey";
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionWatchHistory" DROP CONSTRAINT IF EXISTS "SessionWatchHistory_studentId_fkey";
ALTER TABLE "SessionWatchHistory" ADD CONSTRAINT "SessionWatchHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentSkillProgress" DROP CONSTRAINT IF EXISTS "StudentSkillProgress_studentId_fkey";
ALTER TABLE "StudentSkillProgress" ADD CONSTRAINT "StudentSkillProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModuleWatchProgress" DROP CONSTRAINT IF EXISTS "ModuleWatchProgress_studentId_fkey";
ALTER TABLE "ModuleWatchProgress" ADD CONSTRAINT "ModuleWatchProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeLog" DROP CONSTRAINT IF EXISTS "PracticeLog_studentId_fkey";
ALTER TABLE "PracticeLog" ADD CONSTRAINT "PracticeLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SkillChallengeCompletion" DROP CONSTRAINT IF EXISTS "SkillChallengeCompletion_studentId_fkey";
ALTER TABLE "SkillChallengeCompletion" ADD CONSTRAINT "SkillChallengeCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningStyleProfile" DROP CONSTRAINT IF EXISTS "LearningStyleProfile_studentId_fkey";
ALTER TABLE "LearningStyleProfile" ADD CONSTRAINT "LearningStyleProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonalBest" DROP CONSTRAINT IF EXISTS "PersonalBest_studentId_fkey";
ALTER TABLE "PersonalBest" ADD CONSTRAINT "PersonalBest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimelineEntry" DROP CONSTRAINT IF EXISTS "TimelineEntry_studentId_fkey";
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopEnrollment" DROP CONSTRAINT IF EXISTS "WorkshopEnrollment_studentId_fkey";
ALTER TABLE "WorkshopEnrollment" ADD CONSTRAINT "WorkshopEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentCertification" DROP CONSTRAINT IF EXISTS "StudentCertification_studentId_fkey";
ALTER TABLE "StudentCertification" ADD CONSTRAINT "StudentCertification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTracker" DROP CONSTRAINT IF EXISTS "ProjectTracker_studentId_fkey";
ALTER TABLE "ProjectTracker" ADD CONSTRAINT "ProjectTracker_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressComparison" DROP CONSTRAINT IF EXISTS "ProgressComparison_studentId_fkey";
ALTER TABLE "ProgressComparison" ADD CONSTRAINT "ProgressComparison_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentAward" DROP CONSTRAINT IF EXISTS "StudentAward_studentId_fkey";
ALTER TABLE "StudentAward" ADD CONSTRAINT "StudentAward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentAward" DROP CONSTRAINT IF EXISTS "StudentAward_awardedBy_fkey";
ALTER TABLE "StudentAward" ADD CONSTRAINT "StudentAward_awardedBy_fkey" FOREIGN KEY ("awardedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BreakthroughMoment" DROP CONSTRAINT IF EXISTS "BreakthroughMoment_studentId_fkey";
ALTER TABLE "BreakthroughMoment" ADD CONSTRAINT "BreakthroughMoment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShowcasePresentation" DROP CONSTRAINT IF EXISTS "ShowcasePresentation_studentId_fkey";
ALTER TABLE "ShowcasePresentation" ADD CONSTRAINT "ShowcasePresentation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WallOfFame" DROP CONSTRAINT IF EXISTS "WallOfFame_studentId_fkey";
ALTER TABLE "WallOfFame" ADD CONSTRAINT "WallOfFame_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentOfMonth" DROP CONSTRAINT IF EXISTS "StudentOfMonth_studentId_fkey";
ALTER TABLE "StudentOfMonth" ADD CONSTRAINT "StudentOfMonth_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorFeedbackRequest" DROP CONSTRAINT IF EXISTS "MentorFeedbackRequest_studentId_fkey";
ALTER TABLE "MentorFeedbackRequest" ADD CONSTRAINT "MentorFeedbackRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorResponse" DROP CONSTRAINT IF EXISTS "MentorResponse_mentorId_fkey";
ALTER TABLE "MentorResponse" ADD CONSTRAINT "MentorResponse_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorQuestion" DROP CONSTRAINT IF EXISTS "MentorQuestion_studentId_fkey";
ALTER TABLE "MentorQuestion" ADD CONSTRAINT "MentorQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorAnswer" DROP CONSTRAINT IF EXISTS "MentorAnswer_mentorId_fkey";
ALTER TABLE "MentorAnswer" ADD CONSTRAINT "MentorAnswer_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SuccessStory" DROP CONSTRAINT IF EXISTS "SuccessStory_personId_fkey";
ALTER TABLE "SuccessStory" ADD CONSTRAINT "SuccessStory_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CuratedResource" DROP CONSTRAINT IF EXISTS "CuratedResource_mentorId_fkey";
ALTER TABLE "CuratedResource" ADD CONSTRAINT "CuratedResource_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentMotivationLog" DROP CONSTRAINT IF EXISTS "StudentMotivationLog_studentId_fkey";
ALTER TABLE "StudentMotivationLog" ADD CONSTRAINT "StudentMotivationLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResourceRequest" DROP CONSTRAINT IF EXISTS "ResourceRequest_studentId_fkey";
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectFeedback" DROP CONSTRAINT IF EXISTS "ProjectFeedback_reviewerId_fkey";
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicPortfolio" DROP CONSTRAINT IF EXISTS "PublicPortfolio_studentId_fkey";
ALTER TABLE "PublicPortfolio" ADD CONSTRAINT "PublicPortfolio_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassTemplate" DROP CONSTRAINT IF EXISTS "ClassTemplate_reviewedById_fkey";
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClassTemplate" DROP CONSTRAINT IF EXISTS "ClassTemplate_createdById_fkey";
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassOffering" DROP CONSTRAINT IF EXISTS "ClassOffering_instructorId_fkey";
ALTER TABLE "ClassOffering" ADD CONSTRAINT "ClassOffering_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Partner" DROP CONSTRAINT IF EXISTS "Partner_relationshipLeadId_fkey";
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_relationshipLeadId_fkey" FOREIGN KEY ("relationshipLeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClassOfferingApproval" DROP CONSTRAINT IF EXISTS "ClassOfferingApproval_requestedById_fkey";
ALTER TABLE "ClassOfferingApproval" ADD CONSTRAINT "ClassOfferingApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClassOfferingApproval" DROP CONSTRAINT IF EXISTS "ClassOfferingApproval_reviewedById_fkey";
ALTER TABLE "ClassOfferingApproval" ADD CONSTRAINT "ClassOfferingApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClassEnrollment" DROP CONSTRAINT IF EXISTS "ClassEnrollment_studentId_fkey";
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassAttendanceRecord" DROP CONSTRAINT IF EXISTS "ClassAttendanceRecord_studentId_fkey";
ALTER TABLE "ClassAttendanceRecord" ADD CONSTRAINT "ClassAttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassReminder" DROP CONSTRAINT IF EXISTS "ClassReminder_userId_fkey";
ALTER TABLE "ClassReminder" ADD CONSTRAINT "ClassReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventReminder" DROP CONSTRAINT IF EXISTS "EventReminder_userId_fkey";
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolloutCampaign" DROP CONSTRAINT IF EXISTS "RolloutCampaign_createdById_fkey";
ALTER TABLE "RolloutCampaign" ADD CONSTRAINT "RolloutCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassAssignment" DROP CONSTRAINT IF EXISTS "ClassAssignment_createdById_fkey";
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassAssignmentSubmission" DROP CONSTRAINT IF EXISTS "ClassAssignmentSubmission_studentId_fkey";
ALTER TABLE "ClassAssignmentSubmission" ADD CONSTRAINT "ClassAssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMember" DROP CONSTRAINT IF EXISTS "GroupMember_userId_fkey";
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningPath" DROP CONSTRAINT IF EXISTS "LearningPath_studentId_fkey";
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsSnapshot" DROP CONSTRAINT IF EXISTS "AnalyticsSnapshot_studentId_fkey";
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressPrediction" DROP CONSTRAINT IF EXISTS "ProgressPrediction_studentId_fkey";
ALTER TABLE "ProgressPrediction" ADD CONSTRAINT "ProgressPrediction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChallengeParticipant" DROP CONSTRAINT IF EXISTS "ChallengeParticipant_studentId_fkey";
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChallengeSubmission" DROP CONSTRAINT IF EXISTS "ChallengeSubmission_studentId_fkey";
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PassionPassport" DROP CONSTRAINT IF EXISTS "PassionPassport_studentId_fkey";
ALTER TABLE "PassionPassport" ADD CONSTRAINT "PassionPassport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeasonalCompetition" DROP CONSTRAINT IF EXISTS "SeasonalCompetition_createdById_fkey";
ALTER TABLE "SeasonalCompetition" ADD CONSTRAINT "SeasonalCompetition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeasonalCompetition" DROP CONSTRAINT IF EXISTS "SeasonalCompetition_reviewedById_fkey";
ALTER TABLE "SeasonalCompetition" ADD CONSTRAINT "SeasonalCompetition_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompetitionEntry" DROP CONSTRAINT IF EXISTS "CompetitionEntry_studentId_fkey";
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompetitionVote" DROP CONSTRAINT IF EXISTS "CompetitionVote_voterId_fkey";
ALTER TABLE "CompetitionVote" ADD CONSTRAINT "CompetitionVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentContent" DROP CONSTRAINT IF EXISTS "StudentContent_studentId_fkey";
ALTER TABLE "StudentContent" ADD CONSTRAINT "StudentContent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentLike" DROP CONSTRAINT IF EXISTS "ContentLike_userId_fkey";
ALTER TABLE "ContentLike" ADD CONSTRAINT "ContentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentComment" DROP CONSTRAINT IF EXISTS "ContentComment_authorId_fkey";
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RandomReward" DROP CONSTRAINT IF EXISTS "RandomReward_userId_fkey";
ALTER TABLE "RandomReward" ADD CONSTRAINT "RandomReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaderboardEntry" DROP CONSTRAINT IF EXISTS "LeaderboardEntry_userId_fkey";
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MysteryBox" DROP CONSTRAINT IF EXISTS "MysteryBox_userId_fkey";
ALTER TABLE "MysteryBox" ADD CONSTRAINT "MysteryBox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentNominatedChallenge" DROP CONSTRAINT IF EXISTS "StudentNominatedChallenge_nominatorId_fkey";
ALTER TABLE "StudentNominatedChallenge" ADD CONSTRAINT "StudentNominatedChallenge_nominatorId_fkey" FOREIGN KEY ("nominatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NominationVote" DROP CONSTRAINT IF EXISTS "NominationVote_userId_fkey";
ALTER TABLE "NominationVote" ADD CONSTRAINT "NominationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncubatorApplication" DROP CONSTRAINT IF EXISTS "IncubatorApplication_studentId_fkey";
ALTER TABLE "IncubatorApplication" ADD CONSTRAINT "IncubatorApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncubatorApplication" DROP CONSTRAINT IF EXISTS "IncubatorApplication_reviewedById_fkey";
ALTER TABLE "IncubatorApplication" ADD CONSTRAINT "IncubatorApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncubatorProject" DROP CONSTRAINT IF EXISTS "IncubatorProject_studentId_fkey";
ALTER TABLE "IncubatorProject" ADD CONSTRAINT "IncubatorProject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncubatorProject" DROP CONSTRAINT IF EXISTS "IncubatorProject_launchApprovedById_fkey";
ALTER TABLE "IncubatorProject" ADD CONSTRAINT "IncubatorProject_launchApprovedById_fkey" FOREIGN KEY ("launchApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncubatorMilestone" DROP CONSTRAINT IF EXISTS "IncubatorMilestone_approvedById_fkey";
ALTER TABLE "IncubatorMilestone" ADD CONSTRAINT "IncubatorMilestone_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncubatorMentor" DROP CONSTRAINT IF EXISTS "IncubatorMentor_mentorId_fkey";
ALTER TABLE "IncubatorMentor" ADD CONSTRAINT "IncubatorMentor_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncubatorUpdate" DROP CONSTRAINT IF EXISTS "IncubatorUpdate_authorId_fkey";
ALTER TABLE "IncubatorUpdate" ADD CONSTRAINT "IncubatorUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PitchFeedback" DROP CONSTRAINT IF EXISTS "PitchFeedback_reviewerId_fkey";
ALTER TABLE "PitchFeedback" ADD CONSTRAINT "PitchFeedback_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternshipListing" DROP CONSTRAINT IF EXISTS "InternshipListing_postedById_fkey";
ALTER TABLE "InternshipListing" ADD CONSTRAINT "InternshipListing_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternshipApplication" DROP CONSTRAINT IF EXISTS "InternshipApplication_studentId_fkey";
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceProject" DROP CONSTRAINT IF EXISTS "ServiceProject_createdById_fkey";
ALTER TABLE "ServiceProject" ADD CONSTRAINT "ServiceProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceVolunteer" DROP CONSTRAINT IF EXISTS "ServiceVolunteer_studentId_fkey";
ALTER TABLE "ServiceVolunteer" ADD CONSTRAINT "ServiceVolunteer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorCertification" DROP CONSTRAINT IF EXISTS "InstructorCertification_instructorId_fkey";
ALTER TABLE "InstructorCertification" ADD CONSTRAINT "InstructorCertification_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResourceExchangeListing" DROP CONSTRAINT IF EXISTS "ResourceExchangeListing_userId_fkey";
ALTER TABLE "ResourceExchangeListing" ADD CONSTRAINT "ResourceExchangeListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResourceExchangeRequest" DROP CONSTRAINT IF EXISTS "ResourceExchangeRequest_requesterId_fkey";
ALTER TABLE "ResourceExchangeRequest" ADD CONSTRAINT "ResourceExchangeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CohortMember" DROP CONSTRAINT IF EXISTS "CohortMember_userId_fkey";
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PathwayReflection" DROP CONSTRAINT IF EXISTS "PathwayReflection_userId_fkey";
ALTER TABLE "PathwayReflection" ADD CONSTRAINT "PathwayReflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorPathwaySpec" DROP CONSTRAINT IF EXISTS "InstructorPathwaySpec_userId_fkey";
ALTER TABLE "InstructorPathwaySpec" ADD CONSTRAINT "InstructorPathwaySpec_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterPathway" DROP CONSTRAINT IF EXISTS "ChapterPathway_ownerId_fkey";
ALTER TABLE "ChapterPathway" ADD CONSTRAINT "ChapterPathway_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest" DROP CONSTRAINT IF EXISTS "PathwayFallbackRequest_studentId_fkey";
ALTER TABLE "PathwayFallbackRequest" ADD CONSTRAINT "PathwayFallbackRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest" DROP CONSTRAINT IF EXISTS "PathwayFallbackRequest_reviewedById_fkey";
ALTER TABLE "PathwayFallbackRequest" ADD CONSTRAINT "PathwayFallbackRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MentorshipProgramGoal" DROP CONSTRAINT IF EXISTS "MentorshipProgramGoal_createdById_fkey";
ALTER TABLE "MentorshipProgramGoal" ADD CONSTRAINT "MentorshipProgramGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlySelfReflection" DROP CONSTRAINT IF EXISTS "MonthlySelfReflection_menteeId_fkey";
ALTER TABLE "MonthlySelfReflection" ADD CONSTRAINT "MonthlySelfReflection_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorGoalReview" DROP CONSTRAINT IF EXISTS "MentorGoalReview_mentorId_fkey";
ALTER TABLE "MentorGoalReview" ADD CONSTRAINT "MentorGoalReview_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorGoalReview" DROP CONSTRAINT IF EXISTS "MentorGoalReview_menteeId_fkey";
ALTER TABLE "MentorGoalReview" ADD CONSTRAINT "MentorGoalReview_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorGoalReview" DROP CONSTRAINT IF EXISTS "MentorGoalReview_chairReviewerId_fkey";
ALTER TABLE "MentorGoalReview" ADD CONSTRAINT "MentorGoalReview_chairReviewerId_fkey" FOREIGN KEY ("chairReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AchievementPointSummary" DROP CONSTRAINT IF EXISTS "AchievementPointSummary_userId_fkey";
ALTER TABLE "AchievementPointSummary" ADD CONSTRAINT "AchievementPointSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AwardNomination" DROP CONSTRAINT IF EXISTS "AwardNomination_nomineeId_fkey";
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AwardNomination" DROP CONSTRAINT IF EXISTS "AwardNomination_nominatedBy_fkey";
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_nominatedBy_fkey" FOREIGN KEY ("nominatedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AwardNomination" DROP CONSTRAINT IF EXISTS "AwardNomination_chairApproverId_fkey";
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_chairApproverId_fkey" FOREIGN KEY ("chairApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AwardNomination" DROP CONSTRAINT IF EXISTS "AwardNomination_boardApproverId_fkey";
ALTER TABLE "AwardNomination" ADD CONSTRAINT "AwardNomination_boardApproverId_fkey" FOREIGN KEY ("boardApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MentorCommitteeChair" DROP CONSTRAINT IF EXISTS "MentorCommitteeChair_userId_fkey";
ALTER TABLE "MentorCommitteeChair" ADD CONSTRAINT "MentorCommitteeChair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rubric is provisioned only via `prisma db push` (absent from every migration
-- and from the supabase_sync baseline), so its presence/columns can't be proven
-- from migration history. Guard so a missing table/column can't abort the deploy.
DO $$ BEGIN
  ALTER TABLE "Rubric" DROP CONSTRAINT IF EXISTS "Rubric_createdById_fkey";
  ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN undefined_column OR undefined_table OR duplicate_object THEN null; END $$;

ALTER TABLE "InstructorCohort" DROP CONSTRAINT IF EXISTS "InstructorCohort_createdById_fkey";
ALTER TABLE "InstructorCohort" ADD CONSTRAINT "InstructorCohort_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorCohortMember" DROP CONSTRAINT IF EXISTS "InstructorCohortMember_userId_fkey";
ALTER TABLE "InstructorCohortMember" ADD CONSTRAINT "InstructorCohortMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PassionLabProgress: db-push-only table (see Rubric note). Guard defensively.
DO $$ BEGIN
  ALTER TABLE "PassionLabProgress" DROP CONSTRAINT IF EXISTS "PassionLabProgress_studentId_fkey";
  ALTER TABLE "PassionLabProgress" ADD CONSTRAINT "PassionLabProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN undefined_column OR undefined_table OR duplicate_object THEN null; END $$;

-- CompetitionPrepProgress: db-push-only table (see Rubric note). Guard defensively.
DO $$ BEGIN
  ALTER TABLE "CompetitionPrepProgress" DROP CONSTRAINT IF EXISTS "CompetitionPrepProgress_studentId_fkey";
  ALTER TABLE "CompetitionPrepProgress" ADD CONSTRAINT "CompetitionPrepProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN undefined_column OR undefined_table OR duplicate_object THEN null; END $$;

ALTER TABLE "ChapterPresidentApplication" DROP CONSTRAINT IF EXISTS "ChapterPresidentApplication_applicantId_fkey";
ALTER TABLE "ChapterPresidentApplication" ADD CONSTRAINT "ChapterPresidentApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterPresidentApplication" DROP CONSTRAINT IF EXISTS "ChapterPresidentApplication_decisionMakerId_fkey";
ALTER TABLE "ChapterPresidentApplication" ADD CONSTRAINT "ChapterPresidentApplication_decisionMakerId_fkey" FOREIGN KEY ("decisionMakerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChapterPresidentApplication" DROP CONSTRAINT IF EXISTS "ChapterPresidentApplication_reviewerId_fkey";
ALTER TABLE "ChapterPresidentApplication" ADD CONSTRAINT "ChapterPresidentApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChapterPresidentApplication" DROP CONSTRAINT IF EXISTS "ChapterPresidentApplication_linkedPersonId_fkey";
ALTER TABLE "ChapterPresidentApplication" ADD CONSTRAINT "ChapterPresidentApplication_linkedPersonId_fkey" FOREIGN KEY ("linkedPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChapterPresidentApplication" DROP CONSTRAINT IF EXISTS "ChapterPresidentApplication_mentorAdvisorId_fkey";
ALTER TABLE "ChapterPresidentApplication" ADD CONSTRAINT "ChapterPresidentApplication_mentorAdvisorId_fkey" FOREIGN KEY ("mentorAdvisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChapterPresidentApplication" DROP CONSTRAINT IF EXISTS "ChapterPresidentApplication_importedById_fkey";
ALTER TABLE "ChapterPresidentApplication" ADD CONSTRAINT "ChapterPresidentApplication_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApplicationCohort" DROP CONSTRAINT IF EXISTS "ApplicationCohort_createdById_fkey";
ALTER TABLE "ApplicationCohort" ADD CONSTRAINT "ApplicationCohort_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterPresidentOnboarding" DROP CONSTRAINT IF EXISTS "ChapterPresidentOnboarding_userId_fkey";
ALTER TABLE "ChapterPresidentOnboarding" ADD CONSTRAINT "ChapterPresidentOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentChapterFeedback" DROP CONSTRAINT IF EXISTS "ParentChapterFeedback_parentId_fkey";
ALTER TABLE "ParentChapterFeedback" ADD CONSTRAINT "ParentChapterFeedback_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentChapterFeedback" DROP CONSTRAINT IF EXISTS "ParentChapterFeedback_targetUserId_fkey";
ALTER TABLE "ParentChapterFeedback" ADD CONSTRAINT "ParentChapterFeedback_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParentChapterFeedback" DROP CONSTRAINT IF EXISTS "ParentChapterFeedback_studentId_fkey";
ALTER TABLE "ParentChapterFeedback" ADD CONSTRAINT "ParentChapterFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParentSurvey" DROP CONSTRAINT IF EXISTS "ParentSurvey_createdById_fkey";
ALTER TABLE "ParentSurvey" ADD CONSTRAINT "ParentSurvey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentSurveyResponse" DROP CONSTRAINT IF EXISTS "ParentSurveyResponse_parentId_fkey";
ALTER TABLE "ParentSurveyResponse" ADD CONSTRAINT "ParentSurveyResponse_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortalUnlock" DROP CONSTRAINT IF EXISTS "PortalUnlock_userId_fkey";
ALTER TABLE "PortalUnlock" ADD CONSTRAINT "PortalUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnlockRecommendation" DROP CONSTRAINT IF EXISTS "UnlockRecommendation_studentId_fkey";
ALTER TABLE "UnlockRecommendation" ADD CONSTRAINT "UnlockRecommendation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnlockRecommendation" DROP CONSTRAINT IF EXISTS "UnlockRecommendation_mentorId_fkey";
ALTER TABLE "UnlockRecommendation" ADD CONSTRAINT "UnlockRecommendation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Nudge" DROP CONSTRAINT IF EXISTS "Nudge_userId_fkey";
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JourneyMilestone" DROP CONSTRAINT IF EXISTS "JourneyMilestone_userId_fkey";
ALTER TABLE "JourneyMilestone" ADD CONSTRAINT "JourneyMilestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassAnnouncement" DROP CONSTRAINT IF EXISTS "ClassAnnouncement_authorId_fkey";
ALTER TABLE "ClassAnnouncement" ADD CONSTRAINT "ClassAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- QuarterlyFeedbackRequest: db-push-only table (see Rubric note). Guard defensively.
DO $$ BEGIN
  ALTER TABLE "QuarterlyFeedbackRequest" DROP CONSTRAINT IF EXISTS "QuarterlyFeedbackRequest_requestedById_fkey";
  ALTER TABLE "QuarterlyFeedbackRequest" ADD CONSTRAINT "QuarterlyFeedbackRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN undefined_column OR undefined_table OR duplicate_object THEN null; END $$;

ALTER TABLE "MentorshipScheduleRequest" DROP CONSTRAINT IF EXISTS "MentorshipScheduleRequest_requestedById_fkey";
ALTER TABLE "MentorshipScheduleRequest" ADD CONSTRAINT "MentorshipScheduleRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurriculumDraft" DROP CONSTRAINT IF EXISTS "CurriculumDraft_authorId_fkey";
ALTER TABLE "CurriculumDraft" ADD CONSTRAINT "CurriculumDraft_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CurriculumComment" DROP CONSTRAINT IF EXISTS "CurriculumComment_authorId_fkey";
ALTER TABLE "CurriculumComment" ADD CONSTRAINT "CurriculumComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpsRule" DROP CONSTRAINT IF EXISTS "OpsRule_createdById_fkey";
ALTER TABLE "OpsRule" ADD CONSTRAINT "OpsRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GRTemplate" DROP CONSTRAINT IF EXISTS "GRTemplate_createdById_fkey";
ALTER TABLE "GRTemplate" ADD CONSTRAINT "GRTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GRTemplate" DROP CONSTRAINT IF EXISTS "GRTemplate_lastEditedById_fkey";
ALTER TABLE "GRTemplate" ADD CONSTRAINT "GRTemplate_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GRResource" DROP CONSTRAINT IF EXISTS "GRResource_createdById_fkey";
ALTER TABLE "GRResource" ADD CONSTRAINT "GRResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GRTemplateComment" DROP CONSTRAINT IF EXISTS "GRTemplateComment_authorId_fkey";
ALTER TABLE "GRTemplateComment" ADD CONSTRAINT "GRTemplateComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GRDocument" DROP CONSTRAINT IF EXISTS "GRDocument_userId_fkey";
ALTER TABLE "GRDocument" ADD CONSTRAINT "GRDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GRGoalChange" DROP CONSTRAINT IF EXISTS "GRGoalChange_proposedById_fkey";
ALTER TABLE "GRGoalChange" ADD CONSTRAINT "GRGoalChange_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GRGoalChange" DROP CONSTRAINT IF EXISTS "GRGoalChange_reviewedById_fkey";
ALTER TABLE "GRGoalChange" ADD CONSTRAINT "GRGoalChange_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GRDocumentVersion" DROP CONSTRAINT IF EXISTS "GRDocumentVersion_changedById_fkey";
ALTER TABLE "GRDocumentVersion" ADD CONSTRAINT "GRDocumentVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterJoinRequest" DROP CONSTRAINT IF EXISTS "ChapterJoinRequest_userId_fkey";
ALTER TABLE "ChapterJoinRequest" ADD CONSTRAINT "ChapterJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterJoinRequest" DROP CONSTRAINT IF EXISTS "ChapterJoinRequest_reviewedById_fkey";
ALTER TABLE "ChapterJoinRequest" ADD CONSTRAINT "ChapterJoinRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemberOnboardingProgress" DROP CONSTRAINT IF EXISTS "MemberOnboardingProgress_userId_fkey";
ALTER TABLE "MemberOnboardingProgress" ADD CONSTRAINT "MemberOnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterChannelMessage" DROP CONSTRAINT IF EXISTS "ChapterChannelMessage_authorId_fkey";
ALTER TABLE "ChapterChannelMessage" ADD CONSTRAINT "ChapterChannelMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterGoal" DROP CONSTRAINT IF EXISTS "ChapterGoal_createdById_fkey";
ALTER TABLE "ChapterGoal" ADD CONSTRAINT "ChapterGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterInvite" DROP CONSTRAINT IF EXISTS "ChapterInvite_createdById_fkey";
ALTER TABLE "ChapterInvite" ADD CONSTRAINT "ChapterInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeerKudos" DROP CONSTRAINT IF EXISTS "PeerKudos_giverId_fkey";
ALTER TABLE "PeerKudos" ADD CONSTRAINT "PeerKudos_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeerKudos" DROP CONSTRAINT IF EXISTS "PeerKudos_receiverId_fkey";
ALTER TABLE "PeerKudos" ADD CONSTRAINT "PeerKudos_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollegeReadinessRoadmap" DROP CONSTRAINT IF EXISTS "CollegeReadinessRoadmap_userId_fkey";
ALTER TABLE "CollegeReadinessRoadmap" ADD CONSTRAINT "CollegeReadinessRoadmap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollegeActivity" DROP CONSTRAINT IF EXISTS "CollegeActivity_userId_fkey";
ALTER TABLE "CollegeActivity" ADD CONSTRAINT "CollegeActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniPanelist" DROP CONSTRAINT IF EXISTS "AlumniPanelist_userId_fkey";
ALTER TABLE "AlumniPanelist" ADD CONSTRAINT "AlumniPanelist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniPanelRsvp" DROP CONSTRAINT IF EXISTS "AlumniPanelRsvp_userId_fkey";
ALTER TABLE "AlumniPanelRsvp" ADD CONSTRAINT "AlumniPanelRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniIntroRequest" DROP CONSTRAINT IF EXISTS "AlumniIntroRequest_requesterId_fkey";
ALTER TABLE "AlumniIntroRequest" ADD CONSTRAINT "AlumniIntroRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniIntroRequest" DROP CONSTRAINT IF EXISTS "AlumniIntroRequest_alumniId_fkey";
ALTER TABLE "AlumniIntroRequest" ADD CONSTRAINT "AlumniIntroRequest_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopProposalTemplate" DROP CONSTRAINT IF EXISTS "WorkshopProposalTemplate_createdById_fkey";
ALTER TABLE "WorkshopProposalTemplate" ADD CONSTRAINT "WorkshopProposalTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopProposalTemplate" DROP CONSTRAINT IF EXISTS "WorkshopProposalTemplate_updatedById_fkey";
ALTER TABLE "WorkshopProposalTemplate" ADD CONSTRAINT "WorkshopProposalTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkshopProposalSubmission" DROP CONSTRAINT IF EXISTS "WorkshopProposalSubmission_authorId_fkey";
ALTER TABLE "WorkshopProposalSubmission" ADD CONSTRAINT "WorkshopProposalSubmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopProposalSubmission" DROP CONSTRAINT IF EXISTS "WorkshopProposalSubmission_reviewedById_fkey";
ALTER TABLE "WorkshopProposalSubmission" ADD CONSTRAINT "WorkshopProposalSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ManualEmailTask" DROP CONSTRAINT IF EXISTS "ManualEmailTask_markedSentById_fkey";
ALTER TABLE "ManualEmailTask" ADD CONSTRAINT "ManualEmailTask_markedSentById_fkey" FOREIGN KEY ("markedSentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ManualEmailTask" DROP CONSTRAINT IF EXISTS "ManualEmailTask_createdById_fkey";
ALTER TABLE "ManualEmailTask" ADD CONSTRAINT "ManualEmailTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkshopProposalReview" DROP CONSTRAINT IF EXISTS "WorkshopProposalReview_reviewerId_fkey";
ALTER TABLE "WorkshopProposalReview" ADD CONSTRAINT "WorkshopProposalReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopOpportunity" DROP CONSTRAINT IF EXISTS "WorkshopOpportunity_createdById_fkey";
ALTER TABLE "WorkshopOpportunity" ADD CONSTRAINT "WorkshopOpportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegularInstructorAssignment" DROP CONSTRAINT IF EXISTS "RegularInstructorAssignment_instructorId_fkey";
ALTER TABLE "RegularInstructorAssignment" ADD CONSTRAINT "RegularInstructorAssignment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RegularInstructorAssignment" DROP CONSTRAINT IF EXISTS "RegularInstructorAssignment_createdById_fkey";
ALTER TABLE "RegularInstructorAssignment" ADD CONSTRAINT "RegularInstructorAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RegularInstructorAssignment" DROP CONSTRAINT IF EXISTS "RegularInstructorAssignment_updatedById_fkey";
ALTER TABLE "RegularInstructorAssignment" ADD CONSTRAINT "RegularInstructorAssignment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorNote" DROP CONSTRAINT IF EXISTS "InstructorNote_authorId_fkey";
ALTER TABLE "InstructorNote" ADD CONSTRAINT "InstructorNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItem" DROP CONSTRAINT IF EXISTS "ActionItem_leadId_fkey";
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionItem" DROP CONSTRAINT IF EXISTS "ActionItem_createdById_fkey";
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuarterlyReview" DROP CONSTRAINT IF EXISTS "QuarterlyReview_createdById_fkey";
ALTER TABLE "QuarterlyReview" ADD CONSTRAINT "QuarterlyReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadershipContributionActivity" DROP CONSTRAINT IF EXISTS "LeadershipContributionActivity_authorId_fkey";
ALTER TABLE "LeadershipContributionActivity" ADD CONSTRAINT "LeadershipContributionActivity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdvisingNote" DROP CONSTRAINT IF EXISTS "AdvisingNote_authorId_fkey";
ALTER TABLE "AdvisingNote" ADD CONSTRAINT "AdvisingNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdvisingRecommendation" DROP CONSTRAINT IF EXISTS "AdvisingRecommendation_authorId_fkey";
ALTER TABLE "AdvisingRecommendation" ADD CONSTRAINT "AdvisingRecommendation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
