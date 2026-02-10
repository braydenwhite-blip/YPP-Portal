import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function StudyGroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user's enrolled courses
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: { course: true },
    orderBy: { createdAt: "desc" }
  });

  // Get study groups the user is a member of
  const userGroups = await prisma.studyGroupMember.findMany({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          course: true,
          createdBy: true,
          members: {
            include: { user: true }
          },
          _count: {
            select: { messages: true, resources: true }
          }
        }
      }
    }
  });

  // Get available study groups for user's courses
  const courseIds = enrollments.map(e => e.courseId);
  const availableGroups = await prisma.studyGroup.findMany({
    where: {
      courseId: { in: courseIds },
      isActive: true,
      NOT: {
        members: {
          some: { userId: session.user.id }
        }
      }
    },
    include: {
      course: true,
      createdBy: true,
      members: {
        include: { user: true }
      },
      _count: {
        select: { messages: true, resources: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Community</p>
          <h1 className="page-title">Study Groups</h1>
        </div>
        <Link href="/study-groups/create" className="button primary">
          Create Study Group
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>About Study Groups</h3>
          <p>
            Connect with classmates to collaborate, share resources, and support each other's learning.
            Study groups are tied to specific courses and include shared messaging and resource spaces.
          </p>
        </div>
        <div className="card">
          <div className="grid two">
            <div>
              <div className="kpi">{userGroups.length}</div>
              <div className="kpi-label">Your Groups</div>
            </div>
            <div>
              <div className="kpi">{availableGroups.length}</div>
              <div className="kpi-label">Available to Join</div>
            </div>
          </div>
        </div>
      </div>

      {/* User's Study Groups */}
      {userGroups.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">Your Study Groups</div>
          <div className="grid two">
            {userGroups.map(({ group, role }) => {
              const isFull = group.maxMembers && group.members.length >= group.maxMembers;

              return (
                <Link
                  key={group.id}
                  href={`/study-groups/${group.id}`}
                  className="card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3>{group.name}</h3>
                      {role === "CREATOR" && (
                        <span className="pill primary" style={{ marginTop: 4 }}>Creator</span>
                      )}
                      {role === "MODERATOR" && (
                        <span className="pill secondary" style={{ marginTop: 4 }}>Moderator</span>
                      )}
                    </div>
                  </div>

                  <p style={{ marginTop: 8, color: "var(--text-secondary)" }}>
                    {group.description || "No description provided"}
                  </p>

                  <div style={{ marginTop: 12 }}>
                    <span className="pill">{group.course.title}</span>
                  </div>

                  <div className="grid three" style={{ marginTop: 16 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{group.members.length}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {isFull ? `${group.maxMembers} max` : "Members"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{group._count.messages}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Messages</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{group._count.resources}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Resources</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Study Groups */}
      {availableGroups.length > 0 && (
        <div>
          <div className="section-title">Available Study Groups</div>
          <div className="grid two">
            {availableGroups.map((group) => {
              const isFull = group.maxMembers && group.members.length >= group.maxMembers;

              return (
                <div key={group.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3>{group.name}</h3>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                        Created by {group.createdBy.name}
                      </p>
                    </div>
                    {isFull && (
                      <span className="pill" style={{ backgroundColor: "var(--error-bg)", color: "var(--error-color)" }}>
                        Full
                      </span>
                    )}
                  </div>

                  <p style={{ marginTop: 8, color: "var(--text-secondary)" }}>
                    {group.description || "No description provided"}
                  </p>

                  <div style={{ marginTop: 12 }}>
                    <span className="pill">{group.course.title}</span>
                  </div>

                  <div className="grid three" style={{ marginTop: 16 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>
                        {group.members.length}
                        {group.maxMembers && `/${group.maxMembers}`}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Members</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{group._count.messages}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Messages</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{group._count.resources}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Resources</div>
                    </div>
                  </div>

                  {!isFull && (
                    <form action="/api/study-groups/join" method="POST" style={{ marginTop: 16 }}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <button type="submit" className="button primary" style={{ width: "100%" }}>
                        Join Group
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {userGroups.length === 0 && availableGroups.length === 0 && (
        <div className="card">
          <h3>No Study Groups Yet</h3>
          <p>
            Be the first to create a study group for one of your courses!
          </p>
          <Link href="/study-groups/create" className="button primary" style={{ marginTop: 12 }}>
            Create Study Group
          </Link>
        </div>
      )}
    </div>
  );
}
