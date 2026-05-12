import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { createOpportunity } from "@/lib/workshop-opportunity-actions";
import { prisma } from "@/lib/prisma";
import OpportunityForm from "../opportunity-form";

export const dynamic = "force-dynamic";

async function createAndRedirect(formData: FormData) {
  "use server";
  const result = await createOpportunity(formData);
  redirect(`/admin/opportunities/${result.opportunityId}`);
}

export default async function NewOpportunityPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const chapters = await prisma.chapter.findMany({
    select: { id: true, name: true, region: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Assignment operations</p>
          <h1 className="page-title">New opportunity</h1>
          <p className="page-subtitle">
            Create a partner program, camp, or workshop that needs instructors.
            You can fill in partner contacts and dates later — only the title is required.
          </p>
        </div>
      </div>

      <OpportunityForm action={createAndRedirect} chapters={chapters} submitLabel="Create" />
    </div>
  );
}
