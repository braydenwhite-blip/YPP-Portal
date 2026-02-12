import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getWorldData } from "@/lib/world-actions";
import {
  WorldErrorBoundary,
  WorldLoadingSkeleton,
} from "@/components/world/passion-world";

const PassionWorld = dynamic(
  () => import("@/components/world/passion-world"),
  { ssr: false },
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

  return (
    <WorldErrorBoundary>
      <Suspense fallback={<WorldLoadingSkeleton />}>
        <WorldContent />
      </Suspense>
    </WorldErrorBoundary>
  );
}
