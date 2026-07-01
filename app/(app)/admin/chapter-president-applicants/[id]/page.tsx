import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleType } from "@prisma/client";
import type { ReactNode } from "react";

import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { PageHeaderV2 } from "@/components/ui-v2";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/page-guards";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import {
  CP_INTERVIEW_QUESTION_GROUPS,
  CP_RUBRIC_FIELDS,
  CP_SCORE_OPTIONS,
  cpMissingRequirements,
  cpNextAction,
  cpStatusLabel,
  cpStrongestSignal,
} from "@/lib/chapter-president-lifecycle";
import {
  assignCPChapterAction,
  assignCPReviewerAction,
  beginCPInitialReviewAction,
  completeCPInterviewAction,
  completeCPOnboardingAction,
  createCPStarterActionsAction,
  linkCPPersonAndRoleAction,
  makeCPDecisionAction,
  markCPAcceptanceEmailSentAction,
  saveCPReviewAction,
  scheduleCPInterviewAction,
} from "@/lib/chapter-president-application-actions";
import { CreateChapterFromApplicationButton } from "@/components/chapters/create-chapter-from-application-button";

type PageProps = {
  params: Promise<{ id: string }>;
};

function fmt(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateTimeLocal(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value || "Not provided"}</div>
    </div>
  );
}

function TextBlock({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 14 }}>
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card" style={{ padding: 18 }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function HiddenId({ id }: { id: string }) {
  return <input type="hidden" name="applicationId" value={id} />;
}

function ScoreSelect({
  name,
  value,
}: {
  name: string;
  value?: number | null;
}) {
  return (
    <select className="input" name={name} defaultValue={value ? String(value) : ""}>
      {CP_SCORE_OPTIONS.map((option) => (
        <option key={`${name}-${option.label}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default async function CPApplicantWorkspacePage({ params }: PageProps) {
  await requireAdminPage();
  const { id } = await params;

  const [app, reviewers, chapters, mentorOptions, workflowItem] = await Promise.all([
    prisma.chapterPresidentApplication.findUnique({
      where: { id },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            chapter: { select: { id: true, name: true } },
            chapterPresidentOnboarding: true,
          },
        },
        chapter: { select: { id: true, name: true, city: true, region: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        decisionMaker: { select: { id: true, name: true } },
        linkedPerson: { select: { id: true, name: true, email: true, primaryRole: true } },
        mentorAdvisor: { select: { id: true, name: true, email: true } },
        customResponses: {
          include: { field: { select: { label: true, fieldType: true } } },
          orderBy: { createdAt: "asc" },
        },
        availabilityWindows: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
      },
    }),
    prisma.user.findMany({
      where: {
        roles: { some: { role: { in: [RoleType.ADMIN, RoleType.HIRING_CHAIR] } } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.chapter.findMany({
      select: { id: true, name: true, city: true, region: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        roles: { some: { role: { in: [RoleType.MENTOR, RoleType.ADMIN, RoleType.CHAPTER_PRESIDENT] } } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.workflowItem.findUnique({
      where: {
        sourceType_sourceId_kind: {
          sourceType: "ChapterPresidentApplication",
          sourceId: id,
          kind: "CHAPTER_PRESIDENT_APPLICATION",
        },
      },
      include: {
        actionItems: {
          include: { owner: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  if (!app) notFound();

  const displayName = formatApplicantDisplayName(app);
  const missing = cpMissingRequirements(app);
  const location = [app.city, app.stateProvince, app.country].filter(Boolean).join(", ");
  const chapterLabel =
    app.chapter?.name ??
    app.applicant.chapter?.name ??
    app.partnerSchool ??
    app.potentialChapterLocation ??
    "No chapter assigned";

  return (
    <ApplicationReviewShell
      maxWidth={1200}
      header={
        <PageHeaderV2
          eyebrow="Chapter president"
          title={displayName}
          subtitle={`${cpStatusLabel(app.status)} · ${cpNextAction(app)}`}
          actions={<span className="badge">{cpStatusLabel(app.status)}</span>}
        />
      }
      actions={[
        { label: "CP pipeline", href: "/admin/chapter-president-applicants", icon: "list" },
        { label: "Home", href: "/", icon: "compass" },
      ]}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <Section title="Applicant snapshot">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <Field label="Email" value={app.applicant.email} />
              <Field label="School" value={app.schoolName} />
              <Field label="Grade" value={app.grade ?? (app.graduationYear ? `Class of ${app.graduationYear}` : null)} />
              <Field label="Location" value={location} />
              <Field label="Chapter / community" value={chapterLabel} />
              <Field label="Applied" value={fmt(app.createdAt)} />
              <Field label="Assigned owner" value={app.reviewer?.name ?? "Needs reviewer"} />
              <Field label="Next step" value={cpNextAction(app)} />
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <form action={assignCPReviewerAction} style={{ display: "flex", gap: 8, alignItems: "end" }}>
                <HiddenId id={app.id} />
                <label style={{ flex: 1, fontSize: 12, color: "var(--muted)" }}>
                  Reviewer / owner
                  <select className="input" name="reviewerId" defaultValue={app.reviewerId ?? ""} style={{ marginTop: 4 }}>
                    <option value="">Needs reviewer</option>
                    {reviewers.map((reviewer) => (
                      <option key={reviewer.id} value={reviewer.id}>{reviewer.name}</option>
                    ))}
                  </select>
                </label>
                <button className="button secondary small" type="submit">Save</button>
              </form>

              <form action={assignCPChapterAction} style={{ display: "flex", gap: 8, alignItems: "end" }}>
                <HiddenId id={app.id} />
                <label style={{ flex: 1, fontSize: 12, color: "var(--muted)" }}>
                  Chapter
                  <select className="input" name="chapterId" defaultValue={app.chapterId ?? ""} style={{ marginTop: 4 }}>
                    <option value="">No chapter assigned</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name}
                        {chapter.city ? ` - ${chapter.city}${chapter.region ? ", " + chapter.region : ""}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button secondary small" type="submit">Save</button>
              </form>

              {!app.chapterId && <CreateChapterFromApplicationButton applicationId={app.id} />}
              {app.chapter && (
                <Link
                  href={`/admin/chapters/${app.chapter.id}`}
                  className="link"
                  style={{ fontSize: 12, display: "inline-block", marginTop: 8 }}
                >
                  Open chapter workspace →
                </Link>
              )}
            </div>

            {missing.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {missing.map((item) => (
                  <span key={item} className="pill" style={{ background: "#fef3c7", color: "#92400e" }}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section title="Application answers">
            <TextBlock label="Strongest signal" value={cpStrongestSignal(app)} />
            <TextBlock label="Why they want to start or lead a chapter" value={app.whyChapterPresident} />
            <TextBlock label="Current YPP involvement" value={app.currentYppInvolvement} />
            <TextBlock label="Leadership experience" value={app.leadershipExperience} />
            <TextBlock label="Community / service experience" value={app.communityServiceExperience} />
            <TextBlock label="Potential chapter location" value={app.potentialChapterLocation} />
            <TextBlock label="Chapter vision" value={app.chapterVision} />
            <TextBlock label="Recruitment plan" value={app.recruitmentPlan} />
            <TextBlock label="Launch plan" value={app.launchPlan} />
            <TextBlock label="Expected first 3 actions if accepted" value={app.firstThreeActions} />
            <TextBlock label="Prior organizing" value={app.priorOrganizing} />
            <TextBlock label="Extracurriculars" value={app.extracurriculars} />
            <TextBlock label="Special skills" value={app.specialSkills} />
            <TextBlock label="Interview availability" value={app.availability} />
            {app.customResponses.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {app.customResponses.map((response) => (
                  <TextBlock
                    key={response.id}
                    label={response.field.label}
                    value={response.fileUrl ? `${response.value}\n${response.fileUrl}` : response.value}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Review panel">
            {app.status === "SUBMITTED" && (
              <form action={beginCPInitialReviewAction} style={{ marginBottom: 14 }}>
                <HiddenId id={app.id} />
                <button className="button small" type="submit">Begin review</button>
              </form>
            )}
            <form action={saveCPReviewAction} style={{ display: "grid", gap: 12 }}>
              <HiddenId id={app.id} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {CP_RUBRIC_FIELDS.map((field) => (
                  <label key={field.key} style={{ fontSize: 12, color: "var(--muted)" }}>
                    {field.label}
                    <ScoreSelect name={field.key} value={app[field.key]} />
                  </label>
                ))}
              </div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Reviewer notes
                <textarea className="input" name="reviewerNotes" rows={4} defaultValue={app.reviewerNotes ?? ""} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>
                  Overall recommendation
                  <select className="input" name="reviewRecommendation" defaultValue="">
                    <option value="">Save notes only</option>
                    <option value="interview">Needs interview</option>
                    <option value="decision">Ready for decision</option>
                    <option value="needs_more_info">Needs more info</option>
                  </select>
                </label>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>
                  Info request message
                  <input className="input" name="infoRequest" defaultValue={app.infoRequest ?? ""} />
                </label>
              </div>
              <button className="button small" type="submit">Save review</button>
            </form>
          </Section>

          <Section title="Interview panel">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
              <Field label="Interview scheduled" value={app.interviewScheduledAt ? fmt(app.interviewScheduledAt) : "Not scheduled"} />
              <Field label="Meeting link" value={app.interviewMeetingUrl} />
              <Field label="Interview score" value={app.interviewScore ? `${app.interviewScore}/5` : "Not scored"} />
            </div>

            <form action={scheduleCPInterviewAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10, alignItems: "end", marginBottom: 16 }}>
              <HiddenId id={app.id} />
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Date and time
                <input className="input" type="datetime-local" name="scheduledAt" defaultValue={dateTimeLocal(app.interviewScheduledAt)} required />
              </label>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Meeting link
                <input className="input" name="meetingUrl" defaultValue={app.interviewMeetingUrl ?? ""} placeholder="https://..." />
              </label>
              <button className="button secondary small" type="submit">Schedule</button>
            </form>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Suggested question groups</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CP_INTERVIEW_QUESTION_GROUPS.map((question) => (
                  <span key={question} className="pill">{question}</span>
                ))}
              </div>
            </div>

            <form action={completeCPInterviewAction} style={{ display: "grid", gap: 12 }}>
              <HiddenId id={app.id} />
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Interview notes
                <textarea className="input" name="interviewNotes" rows={5} defaultValue={app.interviewNotes ?? app.interviewSummary ?? ""} required />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 12 }}>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>
                  Score
                  <ScoreSelect name="interviewScore" value={app.interviewScore} />
                </label>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>
                  Concerns
                  <input className="input" name="interviewConcerns" defaultValue={app.interviewConcerns ?? ""} />
                </label>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>
                  Follow-up questions
                  <input className="input" name="interviewFollowUpQuestions" defaultValue={app.interviewFollowUpQuestions ?? ""} />
                </label>
              </div>
              <button className="button small" type="submit">Mark interview complete</button>
            </form>
          </Section>

          <Section title="Decision panel">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
              <Field label="Recommended decision" value={app.decisionRecommendation ?? "Not set"} />
              <Field label="Decision maker" value={app.decisionMaker?.name ?? "Not decided"} />
              <Field label="Decision timestamp" value={app.decisionAt ? fmt(app.decisionAt) : "Not decided"} />
              <Field label="Any concerns" value={app.interviewConcerns ?? "None recorded"} />
            </div>
            <TextBlock label="Recommendation rationale" value={app.recommendationRationale} />
            <TextBlock label="Final decision note" value={app.finalDecisionNote} />

            <form action={makeCPDecisionAction} style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <HiddenId id={app.id} />
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Final decision note
                <textarea className="input" name="finalDecisionNote" rows={3} defaultValue={app.finalDecisionNote ?? ""} />
              </label>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Request-more-info message
                <input className="input" name="infoRequest" defaultValue={app.infoRequest ?? ""} />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="button small" name="decision" value="ACCEPT" type="submit">Accept</button>
                <button className="button secondary small" name="decision" value="WAITLIST" type="submit">Waitlist</button>
                <button className="button secondary small" name="decision" value="NEEDS_MORE_INFO" type="submit">Request more info</button>
                <button className="button secondary small" name="decision" value="DECLINE" type="submit">Decline</button>
              </div>
            </form>
          </Section>
        </div>

        <aside style={{ display: "grid", gap: 18 }}>
          <Section title="Onboarding panel">
            <div style={{ display: "grid", gap: 10 }}>
              <ChecklistRow
                done={Boolean(app.acceptanceEmailSentAt)}
                label="Acceptance email sent"
                detail={app.acceptanceEmailSentAt ? fmt(app.acceptanceEmailSentAt) : "Send or mark sent"}
              />
              {!app.acceptanceEmailSentAt && (
                <form action={markCPAcceptanceEmailSentAction}>
                  <HiddenId id={app.id} />
                  <button className="button secondary small" type="submit">Send / mark sent</button>
                </form>
              )}

              <ChecklistRow
                done={Boolean(app.linkedPersonId && app.roleAssignedAt)}
                label="Linked person record + CP role"
                detail={app.linkedPerson?.name ?? "Needs linked person record"}
              />
              {!(app.linkedPersonId && app.roleAssignedAt) && (
                <form action={linkCPPersonAndRoleAction} style={{ display: "grid", gap: 8 }}>
                  <HiddenId id={app.id} />
                  <label style={{ fontSize: 12, color: "var(--muted)" }}>
                    Mentor/advisor
                    <select className="input" name="mentorAdvisorId" defaultValue={app.mentorAdvisorId ?? ""}>
                      <option value="">Assign later</option>
                      {mentorOptions.map((mentor) => (
                        <option key={mentor.id} value={mentor.id}>
                          {mentor.name || mentor.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button secondary small" type="submit">Create linked CP profile</button>
                </form>
              )}

              <ChecklistRow
                done={Boolean(app.mentorAdvisorId)}
                label="Mentor/advisor assigned"
                detail={app.mentorAdvisor?.name ?? "Assign if available"}
              />

              <ChecklistRow
                done={Boolean(app.starterActionsCreatedAt)}
                label="First chapter launch actions"
                detail={app.starterActionsCreatedAt ? fmt(app.starterActionsCreatedAt) : "Needs first chapter launch actions"}
              />
              {!app.starterActionsCreatedAt && (
                <form action={createCPStarterActionsAction}>
                  <HiddenId id={app.id} />
                  <button className="button secondary small" type="submit">Create starter actions</button>
                </form>
              )}

              <ChecklistRow
                done={Boolean(app.onboardingCompletedAt)}
                label="Onboarding complete"
                detail={app.onboardingCompletedAt ? fmt(app.onboardingCompletedAt) : "Not complete"}
              />
              {!app.onboardingCompletedAt && (
                <form action={completeCPOnboardingAction}>
                  <HiddenId id={app.id} />
                  <button className="button small" type="submit">Mark onboarding complete</button>
                </form>
              )}
            </div>
          </Section>

          <Section title="Starter actions">
            {workflowItem?.actionItems.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {workflowItem.actionItems.map((item) => (
                  <div key={item.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {item.status.replace(/_/g, " ")}
                      {item.owner?.name ? ` - ${item.owner.name}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                No starter actions created yet.
              </p>
            )}
          </Section>

          <Section title="Active CP profile">
            <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
              <Field label="Linked person" value={app.linkedPerson ? app.linkedPerson.name : "Not linked"} />
              <Field label="Role/title" value={app.linkedPerson?.primaryRole === "CHAPTER_PRESIDENT" ? "Chapter President" : "Not active yet"} />
              <Field label="School/location" value={[app.schoolName, location].filter(Boolean).join(" - ")} />
              <Field label="Chapter/community" value={chapterLabel} />
              <Field label="Mentor/advisor" value={app.mentorAdvisor?.name ?? "Not assigned"} />
              <Field label="Application history" value={`Applied ${fmt(app.createdAt)} - ${cpStatusLabel(app.status)}`} />
            </div>
          </Section>
        </aside>
      </div>
    </ApplicationReviewShell>
  );
}

function ChecklistRow({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: done ? "#dcfce7" : "#fef3c7",
          color: done ? "#166534" : "#92400e",
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {done ? "OK" : "!"}
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{detail}</div>
      </div>
    </div>
  );
}
