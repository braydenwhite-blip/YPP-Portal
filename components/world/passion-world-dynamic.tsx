"use client";

import dynamic from "next/dynamic";
import type { WorldData } from "@/lib/world-actions";
import { WorldLoadingSkeleton } from "./world-loading";

const PassionWorld = dynamic(
  () => import("@/components/world/passion-world"),
  { ssr: false, loading: () => <WorldLoadingSkeleton /> }
);

export function PassionWorldDynamic({ data }: { data: WorldData }) {
  return <PassionWorld data={data} />;
}
