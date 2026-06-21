import type { ClassCommandCenter } from "@/lib/classes/command-center";
import { ClassOperationsCardGrid } from "@/components/classes/class-operations-card-grid";

/**
 * The Classes command center — card grid matching the leadership mockup:
 * chapter/partner context, setup facts, and gap banners. Setup gaps sort first.
 */
export function ClassCommandCenter({ data }: { data: ClassCommandCenter }) {
  return <ClassOperationsCardGrid cards={data.cards} />;
}
