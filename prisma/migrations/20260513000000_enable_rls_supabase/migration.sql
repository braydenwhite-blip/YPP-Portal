-- =====================================================================
-- YPP Portal — Row Level Security policies for Supabase
--
-- Defense-in-depth: blocks anon + authenticated direct-DB access via
-- the Supabase JS client / REST / Realtime. Prisma (direct postgres
-- connection / service role) continues to BYPASS RLS and operates
-- normally — application-layer authorization remains the primary
-- access control.
--
-- Tables here are quoted because Prisma's default mapping is the
-- PascalCase model name (no @@map in this schema).
-- =====================================================================

-- ---------- 0. Helper schema + functions ------------------------------
create schema if not exists app;

create or replace function app.current_user_id()
returns text
language sql stable
security definer
set search_path = public
as $$
  select u.id
  from public."User" u
  where u.supabase_auth_id = auth.uid()::text
  limit 1
$$;

create or replace function app.current_user_chapter_id()
returns text
language sql stable
security definer
set search_path = public
as $$
  select u."chapterId"
  from public."User" u
  where u.supabase_auth_id = auth.uid()::text
  limit 1
$$;

create or replace function app.current_parent_profile_id()
returns text
language sql stable
security definer
set search_path = public
as $$
  select p.id
  from public."ParentProfile" p
  join public."User" u on u.id = p."userId"
  where u.supabase_auth_id = auth.uid()::text
  limit 1
$$;

create or replace function app.has_role(roles text[])
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."UserRole" ur
    join public."User" u on u.id = ur."userId"
    where u.supabase_auth_id = auth.uid()::text
      and ur.role::text = any(roles)
  )
$$;

create or replace function app.is_admin()
returns boolean
language sql stable
as $$
  select app.has_role(array['ADMIN','STAFF']);
$$;

create or replace function app.is_staff_or_above()
returns boolean
language sql stable
as $$
  select app.has_role(array['ADMIN','STAFF','CHAPTER_LEAD','HIRING_CHAIR']);
$$;

revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- ---------- 1. USER & ROLES -------------------------------------------
alter table public."User"                   enable row level security;
alter table public."UserRole"               enable row level security;
alter table public."UserAdminSubtype"       enable row level security;
alter table public."UserProfile"            enable row level security;
alter table public."TwoFactorRecovery"      enable row level security;
alter table public."PasswordResetToken"     enable row level security;
alter table public."EmailVerificationToken" enable row level security;

drop policy if exists user_self_read on public."User";
create policy user_self_read on public."User"
  for select to authenticated
  using (
    supabase_auth_id = auth.uid()::text
    or app.is_admin()
    or (
      app.has_role(array['CHAPTER_LEAD','STAFF'])
      and "chapterId" is not distinct from app.current_user_chapter_id()
    )
  );

drop policy if exists user_self_update on public."User";
create policy user_self_update on public."User"
  for update to authenticated
  using (supabase_auth_id = auth.uid()::text or app.is_admin())
  with check (supabase_auth_id = auth.uid()::text or app.is_admin());

drop policy if exists user_admin_insert on public."User";
create policy user_admin_insert on public."User"
  for insert to authenticated
  with check (app.is_admin());

drop policy if exists user_admin_delete on public."User";
create policy user_admin_delete on public."User"
  for delete to authenticated
  using (app.is_admin());

drop policy if exists userrole_select on public."UserRole";
create policy userrole_select on public."UserRole"
  for select to authenticated
  using ("userId" = app.current_user_id() or app.is_admin());

drop policy if exists userrole_modify on public."UserRole";
create policy userrole_modify on public."UserRole"
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

drop policy if exists subtype_select on public."UserAdminSubtype";
create policy subtype_select on public."UserAdminSubtype"
  for select to authenticated
  using ("userId" = app.current_user_id() or app.is_admin());

drop policy if exists subtype_modify on public."UserAdminSubtype";
create policy subtype_modify on public."UserAdminSubtype"
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

drop policy if exists profile_self on public."UserProfile";
create policy profile_self on public."UserProfile"
  for all to authenticated
  using ("userId" = app.current_user_id() or app.is_admin())
  with check ("userId" = app.current_user_id() or app.is_admin());

drop policy if exists twofa_self on public."TwoFactorRecovery";
create policy twofa_self on public."TwoFactorRecovery"
  for all to authenticated
  using ("userId" = app.current_user_id())
  with check ("userId" = app.current_user_id());

drop policy if exists prt_self on public."PasswordResetToken";
create policy prt_self on public."PasswordResetToken"
  for all to authenticated
  using ("userId" = app.current_user_id())
  with check ("userId" = app.current_user_id());

drop policy if exists evt_self on public."EmailVerificationToken";
create policy evt_self on public."EmailVerificationToken"
  for all to authenticated
  using ("userId" = app.current_user_id())
  with check ("userId" = app.current_user_id());

-- ---------- 2. MINOR / PARENT PII -------------------------------------
alter table public."ParentStudent"            enable row level security;
alter table public."ParentProfile"            enable row level security;
alter table public."ParentStudentConnection"  enable row level security;
alter table public."ParentMessage"            enable row level security;
alter table public."ParentNotification"       enable row level security;
alter table public."ParentSettings"           enable row level security;
alter table public."StudentIntakeCase"        enable row level security;
alter table public."StudentIntakeMilestone"   enable row level security;

drop policy if exists ps_link on public."ParentStudent";
create policy ps_link on public."ParentStudent"
  for select to authenticated
  using (
    "parentId" = app.current_user_id()
    or "studentId" = app.current_user_id()
    or app.is_staff_or_above()
  );

drop policy if exists ps_admin_write on public."ParentStudent";
create policy ps_admin_write on public."ParentStudent"
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

drop policy if exists pprof_self on public."ParentProfile";
create policy pprof_self on public."ParentProfile"
  for all to authenticated
  using ("userId" = app.current_user_id() or app.is_staff_or_above())
  with check ("userId" = app.current_user_id() or app.is_admin());

-- Parent-scoped tables reference ParentProfile.id (NOT User.id).
drop policy if exists psc_self on public."ParentStudentConnection";
create policy psc_self on public."ParentStudentConnection"
  for all to authenticated
  using (
    "parentId" = app.current_parent_profile_id()
    or "studentId" = app.current_user_id()
    or app.is_staff_or_above()
  )
  with check (
    "parentId" = app.current_parent_profile_id() or app.is_admin()
  );

drop policy if exists pmsg_self on public."ParentMessage";
create policy pmsg_self on public."ParentMessage"
  for all to authenticated
  using (
    "parentId" = app.current_parent_profile_id()
    or "studentId" = app.current_user_id()
    or app.is_staff_or_above()
  )
  with check (
    "parentId" = app.current_parent_profile_id() or app.is_admin()
  );

drop policy if exists pnot_self on public."ParentNotification";
create policy pnot_self on public."ParentNotification"
  for all to authenticated
  using ("parentId" = app.current_parent_profile_id() or app.is_admin())
  with check ("parentId" = app.current_parent_profile_id() or app.is_admin());

drop policy if exists pset_self on public."ParentSettings";
create policy pset_self on public."ParentSettings"
  for all to authenticated
  using ("parentId" = app.current_parent_profile_id())
  with check ("parentId" = app.current_parent_profile_id());

-- Student intake cases — sensitive (minor wellbeing)
drop policy if exists sic_visible on public."StudentIntakeCase";
create policy sic_visible on public."StudentIntakeCase"
  for select to authenticated
  using (
    "studentUserId" = app.current_user_id()
    or "parentId" = app.current_user_id()
    or "reviewOwnerId" = app.current_user_id()
    or "reviewedById" = app.current_user_id()
    or app.is_staff_or_above()
  );

drop policy if exists sic_write on public."StudentIntakeCase";
create policy sic_write on public."StudentIntakeCase"
  for all to authenticated
  using (app.is_staff_or_above())
  with check (app.is_staff_or_above());

drop policy if exists sim_visible on public."StudentIntakeMilestone";
create policy sim_visible on public."StudentIntakeMilestone"
  for select to authenticated
  using (
    exists (
      select 1 from public."StudentIntakeCase" c
      where c.id = "StudentIntakeMilestone"."intakeCaseId"
        and (
          c."studentUserId" = app.current_user_id()
          or c."parentId" = app.current_user_id()
          or c."reviewOwnerId" = app.current_user_id()
          or c."reviewedById" = app.current_user_id()
          or app.is_staff_or_above()
        )
    )
  );

drop policy if exists sim_write on public."StudentIntakeMilestone";
create policy sim_write on public."StudentIntakeMilestone"
  for all to authenticated
  using (app.is_staff_or_above())
  with check (app.is_staff_or_above());

-- ---------- 3. APPLICATIONS / HIRING ----------------------------------
alter table public."Application"                        enable row level security;
alter table public."InstructorApplication"              enable row level security;
alter table public."InstructorApplicationReview"        enable row level security;
alter table public."InstructorInterviewReview"          enable row level security;
alter table public."InterviewNote"                      enable row level security;
alter table public."Decision"                           enable row level security;
alter table public."ApplicantDocument"                  enable row level security;
alter table public."ChapterPresidentApplication"        enable row level security;
alter table public."InstructorApplicationChairDecision" enable row level security;

drop policy if exists app_visible on public."Application";
create policy app_visible on public."Application"
  for select to authenticated
  using (
    "applicantId" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD','CHAPTER_PRESIDENT'])
  );

drop policy if exists app_insert_self on public."Application";
create policy app_insert_self on public."Application"
  for insert to authenticated
  with check ("applicantId" = app.current_user_id() or app.is_staff_or_above());

drop policy if exists app_write_staff on public."Application";
create policy app_write_staff on public."Application"
  for update to authenticated
  using (app.is_staff_or_above())
  with check (app.is_staff_or_above());

drop policy if exists ia_visible on public."InstructorApplication";
create policy ia_visible on public."InstructorApplication"
  for select to authenticated
  using (
    "applicantId" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD'])
  );

drop policy if exists ia_write_staff on public."InstructorApplication";
create policy ia_write_staff on public."InstructorApplication"
  for all to authenticated
  using (app.is_staff_or_above() or "applicantId" = app.current_user_id())
  with check (app.is_staff_or_above() or "applicantId" = app.current_user_id());

-- Reviews / interview notes: reviewers/admins only; applicant cannot read
drop policy if exists iar_review on public."InstructorApplicationReview";
create policy iar_review on public."InstructorApplicationReview"
  for all to authenticated
  using (app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD']))
  with check (app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD']));

drop policy if exists iir_review on public."InstructorInterviewReview";
create policy iir_review on public."InstructorInterviewReview"
  for all to authenticated
  using (app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD','INSTRUCTOR']))
  with check (app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD','INSTRUCTOR']));

drop policy if exists inote_review on public."InterviewNote";
create policy inote_review on public."InterviewNote"
  for all to authenticated
  using (app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD','INSTRUCTOR']))
  with check (app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD','INSTRUCTOR']));

drop policy if exists dec_staff on public."Decision";
create policy dec_staff on public."Decision"
  for all to authenticated
  using (app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD']))
  with check (app.has_role(array['ADMIN','STAFF','HIRING_CHAIR','CHAPTER_LEAD']));

drop policy if exists appdoc_owner on public."ApplicantDocument";
create policy appdoc_owner on public."ApplicantDocument"
  for all to authenticated
  using (
    app.is_staff_or_above()
    or exists (
      select 1 from public."InstructorApplication" ia
      where ia.id = "ApplicantDocument"."applicationId"
        and ia."applicantId" = app.current_user_id()
    )
  );

drop policy if exists cpa_visible on public."ChapterPresidentApplication";
create policy cpa_visible on public."ChapterPresidentApplication"
  for all to authenticated
  using ("applicantId" = app.current_user_id() or app.is_staff_or_above())
  with check ("applicantId" = app.current_user_id() or app.is_staff_or_above());

drop policy if exists chair_staff on public."InstructorApplicationChairDecision";
create policy chair_staff on public."InstructorApplicationChairDecision"
  for all to authenticated
  using (app.has_role(array['ADMIN','HIRING_CHAIR']))
  with check (app.has_role(array['ADMIN','HIRING_CHAIR']));

-- ---------- 4. MENTORSHIP / REVIEWS -----------------------------------
alter table public."Mentorship"               enable row level security;
alter table public."MentorshipSession"        enable row level security;
alter table public."MentorshipActionItem"     enable row level security;
alter table public."MonthlyGoalReview"        enable row level security;
alter table public."MonthlyGoalRating"        enable row level security;
alter table public."QuarterlyCommitteeReview" enable row level security;
alter table public."MonthlySelfReflection"    enable row level security;
alter table public."ProgressUpdate"           enable row level security;
alter table public."ReflectionSubmission"     enable row level security;

drop policy if exists ms_party on public."Mentorship";
create policy ms_party on public."Mentorship"
  for all to authenticated
  using (
    "mentorId" = app.current_user_id()
    or "menteeId" = app.current_user_id()
    or app.is_staff_or_above()
  )
  with check (app.is_staff_or_above());

drop policy if exists mss_party on public."MentorshipSession";
create policy mss_party on public."MentorshipSession"
  for all to authenticated
  using (
    "createdById" = app.current_user_id()
    or "ledById" = app.current_user_id()
    or "menteeId" = app.current_user_id()
    or app.is_staff_or_above()
  )
  with check (
    "createdById" = app.current_user_id() or app.is_staff_or_above()
  );

drop policy if exists mai_party on public."MentorshipActionItem";
create policy mai_party on public."MentorshipActionItem"
  for all to authenticated
  using (
    "ownerId" = app.current_user_id()
    or "createdById" = app.current_user_id()
    or "menteeId" = app.current_user_id()
    or app.is_staff_or_above()
  )
  with check (
    "createdById" = app.current_user_id() or app.is_staff_or_above()
  );

drop policy if exists mgr_party on public."MonthlyGoalReview";
create policy mgr_party on public."MonthlyGoalReview"
  for all to authenticated
  using (
    "mentorId" = app.current_user_id()
    or "menteeId" = app.current_user_id()
    or "chairId" = app.current_user_id()
    or app.is_staff_or_above()
  )
  with check (
    "mentorId" = app.current_user_id() or app.is_staff_or_above()
  );

drop policy if exists mgrating_party on public."MonthlyGoalRating";
create policy mgrating_party on public."MonthlyGoalRating"
  for all to authenticated
  using (
    exists (
      select 1 from public."MonthlyGoalReview" r
      where r.id = "MonthlyGoalRating"."reviewId"
        and (
          r."mentorId" = app.current_user_id()
          or r."menteeId" = app.current_user_id()
          or r."chairId" = app.current_user_id()
          or app.is_staff_or_above()
        )
    )
  );

drop policy if exists qcr_party on public."QuarterlyCommitteeReview";
create policy qcr_party on public."QuarterlyCommitteeReview"
  for all to authenticated
  using (
    "menteeId" = app.current_user_id()
    or "createdById" = app.current_user_id()
    or app.is_staff_or_above()
  )
  with check (
    "createdById" = app.current_user_id() or app.is_staff_or_above()
  );

drop policy if exists msr_self on public."MonthlySelfReflection";
create policy msr_self on public."MonthlySelfReflection"
  for all to authenticated
  using ("menteeId" = app.current_user_id() or app.is_staff_or_above())
  with check ("menteeId" = app.current_user_id() or app.is_staff_or_above());

drop policy if exists pu_party on public."ProgressUpdate";
create policy pu_party on public."ProgressUpdate"
  for all to authenticated
  using (
    "submittedById" = app.current_user_id()
    or "forUserId" = app.current_user_id()
    or app.is_staff_or_above()
  )
  with check (
    "submittedById" = app.current_user_id() or app.is_staff_or_above()
  );

drop policy if exists rs_self on public."ReflectionSubmission";
create policy rs_self on public."ReflectionSubmission"
  for all to authenticated
  using ("userId" = app.current_user_id() or app.is_staff_or_above())
  with check ("userId" = app.current_user_id() or app.is_staff_or_above());

-- ---------- 5. MESSAGING ----------------------------------------------
alter table public."Conversation"            enable row level security;
alter table public."ConversationParticipant" enable row level security;
alter table public."Message"                 enable row level security;
alter table public."Notification"            enable row level security;

drop policy if exists conv_member on public."Conversation";
create policy conv_member on public."Conversation"
  for select to authenticated
  using (
    exists (
      select 1 from public."ConversationParticipant" p
      where p."conversationId" = "Conversation".id
        and p."userId" = app.current_user_id()
    )
    or app.is_admin()
  );

drop policy if exists cp_self on public."ConversationParticipant";
create policy cp_self on public."ConversationParticipant"
  for select to authenticated
  using (
    "userId" = app.current_user_id()
    or exists (
      select 1 from public."ConversationParticipant" me
      where me."conversationId" = "ConversationParticipant"."conversationId"
        and me."userId" = app.current_user_id()
    )
    or app.is_admin()
  );

drop policy if exists cp_join_self on public."ConversationParticipant";
create policy cp_join_self on public."ConversationParticipant"
  for insert to authenticated
  with check ("userId" = app.current_user_id() or app.is_staff_or_above());

drop policy if exists msg_member_read on public."Message";
create policy msg_member_read on public."Message"
  for select to authenticated
  using (
    exists (
      select 1 from public."ConversationParticipant" p
      where p."conversationId" = "Message"."conversationId"
        and p."userId" = app.current_user_id()
    )
    or app.is_admin()
  );

drop policy if exists msg_send_self on public."Message";
create policy msg_send_self on public."Message"
  for insert to authenticated
  with check (
    "senderId" = app.current_user_id()
    and exists (
      select 1 from public."ConversationParticipant" p
      where p."conversationId" = "Message"."conversationId"
        and p."userId" = app.current_user_id()
    )
  );

drop policy if exists notif_self on public."Notification";
create policy notif_self on public."Notification"
  for all to authenticated
  using ("userId" = app.current_user_id() or app.is_admin())
  with check ("userId" = app.current_user_id() or app.is_admin());

-- ---------- 6. STUDENT PROGRESS / SUBMISSIONS / FILES -----------------
alter table public."Goal"                 enable row level security;
alter table public."CustomGoal"           enable row level security;
alter table public."XpTransaction"        enable row level security;
alter table public."AssignmentSubmission" enable row level security;
alter table public."AttendanceRecord"     enable row level security;
alter table public."VideoProgress"        enable row level security;
alter table public."Certificate"          enable row level security;
alter table public."FileUpload"           enable row level security;

drop policy if exists goal_self on public."Goal";
create policy goal_self on public."Goal"
  for all to authenticated
  using (
    "userId" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','MENTOR','INSTRUCTOR'])
  )
  with check (
    "userId" = app.current_user_id() or app.is_staff_or_above()
  );

drop policy if exists cgoal_self on public."CustomGoal";
create policy cgoal_self on public."CustomGoal"
  for all to authenticated
  using (
    "userId" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','MENTOR','INSTRUCTOR'])
  )
  with check (
    "userId" = app.current_user_id() or app.is_staff_or_above()
  );

drop policy if exists xpt_self on public."XpTransaction";
create policy xpt_self on public."XpTransaction"
  for select to authenticated
  using (
    "userId" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','INSTRUCTOR'])
  );

drop policy if exists xpt_write on public."XpTransaction";
create policy xpt_write on public."XpTransaction"
  for insert to authenticated
  with check (app.is_staff_or_above() or app.has_role(array['INSTRUCTOR']));

-- AssignmentSubmission uses studentId / gradedById
drop policy if exists asub_self on public."AssignmentSubmission";
create policy asub_self on public."AssignmentSubmission"
  for all to authenticated
  using (
    "studentId" = app.current_user_id()
    or "gradedById" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','INSTRUCTOR'])
  )
  with check (
    "studentId" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','INSTRUCTOR'])
  );

drop policy if exists att_self on public."AttendanceRecord";
create policy att_self on public."AttendanceRecord"
  for select to authenticated
  using (
    "userId" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','INSTRUCTOR','CHAPTER_LEAD'])
  );

drop policy if exists att_write on public."AttendanceRecord";
create policy att_write on public."AttendanceRecord"
  for all to authenticated
  using (app.has_role(array['ADMIN','STAFF','INSTRUCTOR']))
  with check (app.has_role(array['ADMIN','STAFF','INSTRUCTOR']));

drop policy if exists vp_self on public."VideoProgress";
create policy vp_self on public."VideoProgress"
  for all to authenticated
  using (
    "userId" = app.current_user_id()
    or app.has_role(array['ADMIN','STAFF','INSTRUCTOR'])
  )
  with check ("userId" = app.current_user_id());

-- Certificate uses recipientId
drop policy if exists cert_self on public."Certificate";
create policy cert_self on public."Certificate"
  for select to authenticated
  using ("recipientId" = app.current_user_id() or app.is_staff_or_above());

drop policy if exists cert_write on public."Certificate";
create policy cert_write on public."Certificate"
  for all to authenticated
  using (app.is_staff_or_above())
  with check (app.is_staff_or_above());

drop policy if exists file_owner on public."FileUpload";
create policy file_owner on public."FileUpload"
  for all to authenticated
  using ("userId" = app.current_user_id() or app.is_staff_or_above())
  with check ("userId" = app.current_user_id() or app.is_staff_or_above());

-- ---------- 7. AUDIT / ANALYTICS --------------------------------------
alter table public."AuditLog"        enable row level security;
alter table public."AnalyticsEvent"  enable row level security;
alter table public."JourneyAuditLog" enable row level security;

drop policy if exists audit_admin on public."AuditLog";
create policy audit_admin on public."AuditLog"
  for select to authenticated using (app.is_admin());

drop policy if exists analytics_self on public."AnalyticsEvent";
create policy analytics_self on public."AnalyticsEvent"
  for select to authenticated
  using ("userId" = app.current_user_id() or app.is_admin());

drop policy if exists janalytics_admin on public."JourneyAuditLog";
create policy janalytics_admin on public."JourneyAuditLog"
  for select to authenticated using (app.is_admin());

-- ---------- 8. SAFE DEFAULT: enable RLS on everything else ------------
-- Tables left with RLS disabled are wide-open to anon/authenticated via
-- the Supabase JS client. This block flips RLS ON for every remaining
-- public table (no policies = deny all). Prisma still works because the
-- service role / direct connection bypasses RLS.
do $$
declare r record;
begin
  for r in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
      and c.relname not like '\_prisma\_%' escape '\'
  loop
    execute format('alter table public.%I enable row level security;', r.tbl);
  end loop;
end$$;
