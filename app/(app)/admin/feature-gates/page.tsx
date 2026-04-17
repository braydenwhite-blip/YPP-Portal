import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  deleteFeatureGateRule,
  getEnabledFeatureKeysForUser,
  listFeatureGateRules,
  setUserFeatureGateRule,
} from "@/lib/feature-gates";
import { FEATURE_KEYS, FEATURE_KEY_DEFAULTS } from "@/lib/feature-gate-constants";
import { normalizeRoleList } from "@/lib/authorization";

type FeatureAccessSearchParams = {
  q?: string;
};

export const metadata = { title: "Feature Access | YPP" };

export default async function AdminFeatureGatesPage({
  searchParams,
}: {
  searchParams: Promise<FeatureAccessSearchParams>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const allRules = await listFeatureGateRules();
  const userRules = allRules.filter((rule) => rule.scope === "USER" && rule.userId);

  const recentUserIds = Array.from(
    new Set(userRules.map((rule) => rule.userId).filter((value): value is string => Boolean(value)))
  ).slice(0, 12);

  const users = query
    ? await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapterId: true,
          chapter: { select: { name: true } },
          roles: { select: { role: true } },
        },
        orderBy: { name: "asc" },
        take: 20,
      })
    : recentUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: recentUserIds } },
          select: {
            id: true,
            name: true,
            email: true,
            primaryRole: true,
            chapterId: true,
            chapter: { select: { name: true } },
            roles: { select: { role: true } },
          },
          orderBy: { name: "asc" },
        })
      : [];

  const enabledFeatureKeysByUser = new Map(
    await Promise.all(
      users.map(async (user) => [
        user.id,
        new Set(
          await getEnabledFeatureKeysForUser({
            userId: user.id,
            chapterId: user.chapterId,
            roles: normalizeRoleList(user.roles, user.primaryRole),
            primaryRole: user.primaryRole,
          })
        ),
      ] as const)
    )
  );

  const userRuleByKey = new Map(
    userRules.map((rule) => [`${rule.userId}:${rule.featureKey}`, rule] as const)
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Feature Access</h1>
          <p className="page-subtitle">
            Search for a user, then enable or disable feature access one feature at a time.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label className="form-row" style={{ flex: "1 1 320px", marginBottom: 0 }}>
            Search user
            <input
              className="input"
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Name or email"
            />
          </label>
          <button type="submit" className="button small">
            Search
          </button>
          <a href="/admin/feature-gates" className="button small ghost" style={{ textDecoration: "none" }}>
            Reset
          </a>
        </form>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
          Default-off features matter most here: `PASSION_WORLD`, `INSTRUCTOR_TEACHING_TOOLS`, and `INTERVIEWER`.
        </p>
      </div>

      {users.length === 0 ? (
        <div className="card">
          <p className="empty">
            {query
              ? "No users matched that search."
              : "Search for a user to manage feature access, or wait for user-specific rules to appear here."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {users.map((user) => {
            const enabledFeatureKeys = enabledFeatureKeysByUser.get(user.id) ?? new Set<string>();
            return (
              <div key={user.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: 4 }}>{user.name}</h3>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                      {user.email} · {user.primaryRole.replace(/_/g, " ")}
                      {user.chapter?.name ? ` · ${user.chapter.name}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Array.from(enabledFeatureKeys).map((featureKey) => (
                      <span key={featureKey} className="pill pill-success">
                        {featureKey}
                      </span>
                    ))}
                    {enabledFeatureKeys.size === 0 ? <span className="pill">No enabled features</span> : null}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                  {FEATURE_KEYS.map((featureKey) => {
                    const userRule = userRuleByKey.get(`${user.id}:${featureKey}`);
                    const isEnabled = enabledFeatureKeys.has(featureKey);

                    return (
                      <div
                        key={featureKey}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: 12,
                          background: "var(--surface-alt)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong>{featureKey}</strong>
                            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                              Effective state: {isEnabled ? "Enabled" : "Disabled"} · Default:{" "}
                              {FEATURE_KEY_DEFAULTS[featureKey] ? "Enabled" : "Disabled"}
                            </p>
                            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                              {userRule
                                ? `User override is ${userRule.enabled ? "ENABLED" : "DISABLED"}${userRule.note ? ` · ${userRule.note}` : ""}`
                                : "No direct user override. Inherited rules or defaults are in effect."}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <form action={setUserFeatureGateRule}>
                              <input type="hidden" name="userId" value={user.id} />
                              <input type="hidden" name="featureKey" value={featureKey} />
                              <input type="hidden" name="enabled" value="true" />
                              <input type="hidden" name="note" value="Enabled from admin feature access page." />
                              <button type="submit" className="button small">
                                Enable
                              </button>
                            </form>
                            <form action={setUserFeatureGateRule}>
                              <input type="hidden" name="userId" value={user.id} />
                              <input type="hidden" name="featureKey" value={featureKey} />
                              <input type="hidden" name="enabled" value="false" />
                              <input type="hidden" name="note" value="Disabled from admin feature access page." />
                              <button type="submit" className="button small outline">
                                Disable
                              </button>
                            </form>
                            {userRule ? (
                              <form action={deleteFeatureGateRule}>
                                <input type="hidden" name="ruleId" value={userRule.id} />
                                <button type="submit" className="button small ghost">
                                  Use Default
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </div>
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
