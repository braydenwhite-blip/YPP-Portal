import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import {
  getMenteeUnlockStatus,
  mentorDirectUnlock,
  createUnlockRecommendation,
} from "@/lib/unlock-manager";
import { revalidatePath } from "next/cache";

const SECTION_LABELS: Record<string, { label: string; description: string }> = {
  challenges: {
    label: "Challenges",
    description: "Daily and weekly challenges, competitions, leaderboards",
  },
  projects: {
    label: "Projects",
    description: "Project incubator, student showcase",
  },
  people_support: {
    label: "People & Support",
    description: "Office hours, events, calendar",
  },
  opportunities: {
    label: "Opportunities",
    description: "Internships, service projects, positions",
  },
};

const BASIC_SECTIONS = new Set(["challenges", "projects", "people_support"]);

export default async function UnlockSectionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const isMentor =
    roles.includes("MENTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("ADMIN");

  if (!isMentor) {
    return (
      <div>
        <h1 className="page-title">Access Denied</h1>
        <p>Only mentors can access this page.</p>
      </div>
    );
  }

  let menteeData: Awaited<ReturnType<typeof getMenteeUnlockStatus>> = [];
  try {
    menteeData = await getMenteeUnlockStatus();
  } catch {
    // Tables may not exist yet
  }

  async function handleDirectUnlock(formData: FormData) {
    "use server";
    const sess = await getServerSession(authOptions);
    if (!sess?.user?.id) return;

    const studentId = formData.get("studentId") as string;
    const sectionKey = formData.get("sectionKey") as string;

    try {
      await mentorDirectUnlock(studentId, sectionKey);
    } catch {
      // Section may require recommendation instead
    }
    revalidatePath("/mentorship/unlock-sections");
  }

  async function handleRecommend(formData: FormData) {
    "use server";
    const sess = await getServerSession(authOptions);
    if (!sess?.user?.id) return;

    const studentId = formData.get("studentId") as string;
    const sectionKey = formData.get("sectionKey") as string;
    const reason = (formData.get("reason") as string) || undefined;

    await createUnlockRecommendation(studentId, sectionKey, reason);
    revalidatePath("/mentorship/unlock-sections");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Unlock Sections for Mentees</h1>
          <p className="page-subtitle">
            Help your mentees access new parts of the portal when they&apos;re
            ready.
          </p>
        </div>
        <Link href="/mentorship" className="button outline small">
          Back to Mentorship
        </Link>
      </div>

      {menteeData.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)" }}>
            No active mentees found. Once you have mentees, you can manage their
            portal sections here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {menteeData.map((mentee) => {
            const unlockedSet = new Set(mentee.unlocked);

            return (
              <div key={mentee.menteeId} className="card">
                <h3 style={{ marginTop: 0 }}>{mentee.menteeName}</h3>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                  }}
                >
                  {mentee.allSections.map((sectionKey) => {
                    const section = SECTION_LABELS[sectionKey];
                    if (!section) return null;

                    const isUnlocked = unlockedSet.has(sectionKey);
                    const isBasic = BASIC_SECTIONS.has(sectionKey);

                    return (
                      <div
                        key={sectionKey}
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: "1px solid var(--border)",
                          background: isUnlocked
                            ? "var(--green-50, #f0fdf4)"
                            : "white",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 14 }}>
                            {isUnlocked ? "🔓" : "🔒"} {section.label}
                          </span>
                          {isUnlocked && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--green-600, #166534)",
                                fontWeight: 600,
                              }}
                            >
                              Unlocked
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            margin: "0 0 8px",
                          }}
                        >
                          {section.description}
                        </p>

                        {!isUnlocked && isBasic && (
                          <form action={handleDirectUnlock}>
                            <input
                              type="hidden"
                              name="studentId"
                              value={mentee.menteeId}
                            />
                            <input
                              type="hidden"
                              name="sectionKey"
                              value={sectionKey}
                            />
                            <button
                              type="submit"
                              className="button small"
                              style={{ fontSize: 12 }}
                            >
                              Unlock Now
                            </button>
                          </form>
                        )}

                        {!isUnlocked && !isBasic && (
                          <form action={handleRecommend}>
                            <input
                              type="hidden"
                              name="studentId"
                              value={mentee.menteeId}
                            />
                            <input
                              type="hidden"
                              name="sectionKey"
                              value={sectionKey}
                            />
                            <input
                              type="text"
                              name="reason"
                              placeholder="Why is this student ready?"
                              style={{
                                fontSize: 12,
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid var(--border)",
                                width: "100%",
                                marginBottom: 6,
                              }}
                            />
                            <button
                              type="submit"
                              className="button outline small"
                              style={{ fontSize: 12 }}
                            >
                              Recommend Unlock
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
