import { notFound, redirect } from "next/navigation";

import { RelationshipWorkspace } from "@/components/mentorship/relationship-workspace/relationship-workspace";
import { getSession } from "@/lib/auth-supabase";
import {
  reassignProgramMentor,
  setProgramMentorshipStatus,
} from "@/lib/mentorship-program-actions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Mentorship relationship — Admin",
};

type EligibleMentor = {
  id: string;
  name: string | null;
  email: string;
  primaryRole: string;
};

function AdminRelationshipControls({
  mentorshipId,
  status,
  eligibleMentors,
}: {
  mentorshipId: string;
  status: string;
  eligibleMentors: EligibleMentor[];
}) {
  const statusToneClass =
    status === "ACTIVE"
      ? "pill-success"
      : status === "PAUSED"
        ? "pill-pending"
        : "pill-declined";

  return (
    <div className="grid two">
      <div className="card">
        <div className="section-title" style={{ marginBottom: 8 }}>
          Reassign mentor
        </div>
        <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
          Ends this relationship and creates a fresh one with the new mentor.
          The change is recorded in the audit log.
        </p>
        <form action={reassignProgramMentor} className="form-grid">
          <input type="hidden" name="mentorshipId" value={mentorshipId} />
          <div className="form-row">
            <label>New mentor</label>
            <select name="newMentorId" className="input" required>
              <option value="">Select mentor...</option>
              {eligibleMentors.map((mentor) => (
                <option key={mentor.id} value={mentor.id}>
                  {mentor.name ?? mentor.email} ({mentor.primaryRole})
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Reason (optional)</label>
            <textarea
              name="reason"
              className="input"
              rows={3}
              placeholder="Why is this mentee being reassigned?"
            />
          </div>
          <button
            type="submit"
            className="button primary small"
            disabled={status !== "ACTIVE"}
          >
            Reassign mentor
          </button>
        </form>
      </div>

      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div className="section-title" style={{ margin: 0 }}>
            Relationship status
          </div>
          <span className={`pill pill-small ${statusToneClass}`}>
            Currently {status}
          </span>
        </div>
        <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
          Pause when the relationship is on hold, mark complete when it closes,
          or reactivate a paused relationship.
        </p>
        <form action={setProgramMentorshipStatus} className="form-grid">
          <input type="hidden" name="mentorshipId" value={mentorshipId} />
          <div className="form-row">
            <label>New status</label>
            <select name="status" className="input" defaultValue={status}>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETE">Complete</option>
            </select>
          </div>
          <div className="form-row">
            <label>Note (optional)</label>
            <textarea
              name="reason"
              className="input"
              rows={2}
              placeholder="Internal note for the audit log."
            />
          </div>
          <button type="submit" className="button secondary small">
            Update status
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function AdminMentorshipRelationshipDetailPage({
  params,
}: {
  params: { mentorshipId: string };
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const mentorship = await prisma.mentorship.findUnique({
    where: { id: params.mentorshipId },
    select: {
      id: true,
      mentorId: true,
      menteeId: true,
      status: true,
    },
  });

  if (!mentorship) {
    notFound();
  }

  const excludedUserIds = [mentorship.mentorId, mentorship.menteeId].filter(
    (id): id is string => Boolean(id)
  );
  const eligibleMentors = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: "MENTOR" } } },
        { roles: { some: { role: "ADMIN" } } },
        { primaryRole: "INSTRUCTOR" },
        { primaryRole: "CHAPTER_PRESIDENT" },
      ],
      NOT: { id: { in: excludedUserIds } },
    },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: { name: "asc" },
  });

  return (
    <RelationshipWorkspace
      menteeId={mentorship.menteeId}
      backHref="/admin/mentorship"
      backLabel="Admin Mentorship"
      badge="Admin · Mentorship relationship"
      subtitle="Shared relationship workspace with admin intervention controls, check-ins, goals, recommendations, and next steps."
      adminControls={
        <AdminRelationshipControls
          mentorshipId={mentorship.id}
          status={mentorship.status}
          eligibleMentors={eligibleMentors}
        />
      }
    />
  );
}
