import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAssignmentDetail } from "@/lib/assignment-actions";
import Link from "next/link";
import { GroupProjectClient } from "./group-client";

export default async function GroupProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id: offeringId, assignmentId } = await params;
  const { group: selectedGroupId } = await searchParams;

  const assignment = await getAssignmentDetail(assignmentId);
  if (!assignment || !assignment.isGroupAssignment) {
    redirect(`/curriculum/${offeringId}/assignments/${assignmentId}`);
  }

  const roles = session.user.roles ?? [];
  const isInstructor = assignment.offering.instructorId === session.user.id || roles.includes("ADMIN");
  const myGroup = assignment.groups.find((g) => g.members.some((m) => m.user.id === session.user.id));
  const selectedGroup = selectedGroupId
    ? assignment.groups.find((g) => g.id === selectedGroupId)
    : myGroup || null;
  const selectedGroupSubmissions = selectedGroup
    ? assignment.submissions.filter((s) => s.groupId === selectedGroup.id)
    : [];

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/curriculum/${offeringId}/assignments/${assignmentId}`} style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; {assignment.title}
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Group Projects</h1>
        </div>
      </div>

      {/* Group Philosophy */}
      <div className="card" style={{ marginBottom: 24, background: "#fffbeb", borderLeft: "4px solid #d97706" }}>
        <div style={{ fontWeight: 600, color: "#d97706" }}>Collaboration is Key</div>
        <p style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
          Working together makes learning more fun! Define your own roles, support each other,
          and remember — everyone contributes in their own way.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
        {/* Groups List */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Groups ({assignment.groups.length})</div>
          </div>

          {assignment.groups.length === 0 ? (
            <div className="card">
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                No groups yet. Be the first to create one!
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {assignment.groups.map((group) => {
                const isMember = group.members.some((m) => m.user.id === session.user.id);
                const isSelected = selectedGroup?.id === group.id;
                const completedMilestones = group.milestones.filter((m) => m.isComplete).length;

                return (
                  <Link
                    key={group.id}
                    href={`/curriculum/${offeringId}/assignments/${assignmentId}/groups?group=${group.id}`}
                    className="card"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      padding: "12px 16px",
                      ...(isSelected ? { borderColor: "var(--ypp-purple)", borderWidth: 2 } : {}),
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 14 }}>{group.groupName}</strong>
                      {isMember && (
                        <span className="pill primary" style={{ fontSize: 10 }}>You</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                      {group.milestones.length > 0 && ` | ${completedMilestones}/${group.milestones.length} milestones`}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Create Group / Join Group */}
          {!myGroup && assignment.allowSelfSelect && (
            <GroupProjectClient
              assignmentId={assignmentId}
              offeringId={offeringId}
              mode="create"
              groups={assignment.groups.map((g) => ({
                id: g.id,
                groupName: g.groupName,
                memberCount: g.members.length,
                maxSize: assignment.groupSize || 5,
              }))}
            />
          )}
        </div>

        {/* Selected Group Detail */}
        <div>
          {selectedGroup ? (
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <h3>{selectedGroup.groupName}</h3>
                {selectedGroup.description && (
                  <p style={{ marginTop: 4, color: "var(--text-secondary)" }}>{selectedGroup.description}</p>
                )}

                {/* Members */}
                <div style={{ marginTop: 16 }}>
                  <h4>Members</h4>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedGroup.members.map((member) => (
                      <div
                        key={member.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "var(--surface-alt)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{member.user.name}</div>
                          {member.role && (
                            <div style={{ fontSize: 12, color: "var(--ypp-purple)" }}>{member.role}</div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Communication */}
                {selectedGroup.communicationChannel && (
                  <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-secondary)" }}>
                    <strong>Communication:</strong> {selectedGroup.communicationChannel}
                  </div>
                )}

                {/* Shared Docs */}
                {selectedGroup.sharedDocLinks.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <strong style={{ fontSize: 14 }}>Shared Documents:</strong>
                    <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                      {selectedGroup.sharedDocLinks.map((link, i) => (
                        <li key={i}>
                          <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ypp-purple)", fontSize: 13 }}>
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Milestones */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3>Milestones</h3>
                  {selectedGroup.milestones.length > 0 && (
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {selectedGroup.milestones.filter((m) => m.isComplete).length} / {selectedGroup.milestones.length} complete
                    </span>
                  )}
                </div>

                {selectedGroup.milestones.length === 0 ? (
                  <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    No milestones set yet. Add milestones to track your group&apos;s progress!
                  </p>
                ) : (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedGroup.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "8px 12px",
                          background: milestone.isComplete ? "#f0fdf4" : "var(--surface-alt)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        <span style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          ...(milestone.isComplete
                            ? { background: "#16a34a", color: "white" }
                            : { background: "var(--gray-200)", color: "var(--gray-500)" }),
                        }}>
                          {milestone.isComplete ? "✓" : "○"}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 14, textDecoration: milestone.isComplete ? "line-through" : "none" }}>
                            {milestone.title}
                          </div>
                          {milestone.targetDate && (
                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                              Target: {new Date(milestone.targetDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Milestone (if member) */}
                {myGroup?.id === selectedGroup.id && (
                  <GroupProjectClient
                    assignmentId={assignmentId}
                    offeringId={offeringId}
                    mode="milestone"
                    groupId={selectedGroup.id}
                  />
                )}
              </div>

              {/* Submissions from this group */}
              {selectedGroupSubmissions.length > 0 && (
                <div className="card">
                  <h3>Group Submissions</h3>
                  <div style={{ marginTop: 8 }}>
                    {selectedGroupSubmissions.map((sub) => (
                      <div
                        key={sub.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: "1px solid var(--border-light)",
                          fontSize: 14,
                        }}
                      >
                        <span>{sub.student.name}</span>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "In progress"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <h3>Select a Group</h3>
              <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
                Choose a group from the list to view details, or create a new group.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
