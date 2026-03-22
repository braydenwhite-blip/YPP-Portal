import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getGRResourceLibrary } from "@/lib/gr-actions";
import GRResourceLibraryPanel from "@/components/gr/gr-resource-library-panel";

export const metadata = { title: "G&R Resources — Admin" };

export default async function GRResourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("ADMIN")) redirect("/");

  const resources = await getGRResourceLibrary();

  const serialized = resources.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    url: r.url,
    isUpload: r.isUpload,
    tags: r.tags,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">G&R Resource Library</h1>
          <p className="page-subtitle">
            Manage shared resources (links and uploads) for G&R documents
          </p>
        </div>
      </div>

      <GRResourceLibraryPanel resources={serialized} />
    </div>
  );
}
