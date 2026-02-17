import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getWorldData } from "@/lib/world-actions";
import Link from "next/link";
import {
  WorldErrorBoundary,
  WorldLoadingSkeleton,
} from "@/components/world/world-loading";
import { isFeatureEnabledForUser } from "@/lib/feature-gates";

const PassionWorld = dynamic(
  () => import("@/components/world/passion-world"),
  { ssr: false, loading: () => <WorldLoadingSkeleton /> },
);

export const metadata = {
  title: "The Passion World | YPP",
  description: "Explore your passion islands and track your growth journey.",
};

async function WorldContent() {
  const data = await getWorldData();
  return <PassionWorld data={data} />;
}

export default async function WorldPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const featureEnabled = await isFeatureEnabledForUser("PASSION_WORLD", {
    userId: session.user.id,
  });

  if (!featureEnabled) {
    return (
      <div>
        <div className="topbar">
          <div>
            <h1 className="page-title">The Passion World</h1>
            <p className="page-subtitle">This section is not enabled for your chapter yet.</p>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pilot rollout in progress</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            Keep tracking your momentum through Activity Hub and Challenges while Passion World access expands.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/activities" className="button secondary">Activity Hub</Link>
            <Link href="/challenges" className="button secondary">Challenges</Link>
            <Link href="/incubator" className="button secondary">Incubator</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WorldErrorBoundary>
      <Suspense fallback={<WorldLoadingSkeleton />}>
        <WorldContent />
      </Suspense>
    </WorldErrorBoundary>
  );
}
